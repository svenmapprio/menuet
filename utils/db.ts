import { Pool } from "pg";
import { Emitter, PostgresEmitterOptions } from "@socket.io/postgres-emitter";
import {
  CamelCasePlugin,
  Kysely,
  PostgresDialect,
  sql,
  Transaction,
} from "kysely";
import { Emission, EmissionWrapper, Session, UsersFilter } from "./types";
import { TokenPayload } from "google-auth-library";
import { NextRequest } from "next/server";
import { DB } from "./tables";
import { cookies } from "next/headers";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import { Returns } from "./routes";
import { AppleIdTokenType } from "apple-signin-auth";

const dbPool = new Pool({
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_DB,
  port: parseInt(process.env.DATABASE_PORT ?? ""),
  password: process.env.DATABASE_PASS,
  user: process.env.DATABASE_USER,
  ssl: {
    host: process.env.SSL_HOST,
    requestCert: true,
    ca: process.env.SSL_CA,
    cert: process.env.SSL_CERT,
    key: process.env.SSL_KEY,
    rejectUnauthorized: true,
  },
});

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: dbPool,
  }),
  plugins: [new CamelCasePlugin()],
  // log: (msg) => console.log(msg)
});

export const pgEmitter = new Emitter(dbPool);

export const emitServer = (emission: Emission) => {
  try {
    const socketIdCookie = cookies().get("socketId");

    console.log(
      "emission type",
      emission.type,
      "socketIdCookie",
      socketIdCookie?.value
    );

    if (socketIdCookie) {
      const socketId = socketIdCookie.value;
      const emissionWrap: EmissionWrapper = {
        isEmission: true,
        emissionPayload: emission,
        socketId,
      };
      pgEmitter.serverSideEmit("emission", emissionWrap);
    }
  } catch (e) {
    console.log("error getting socket", e);
  }
};

export const dbCommon = {
  getSessionBy: async (
    trx: Transaction<DB>,
    { sub, socketId }: { sub?: string; socketId?: string }
  ): Promise<Session | null> => {
    const q = trx
      .selectFrom("account")
      .innerJoin("user", "user.id", "account.userId")
      .select([
        "user.handle",
        "user.id",
        "user.name",
        "user.firstName",
        "user.lastName",
        "account.email",
        "account.sub",
        "account.type",
        "account.userId",
      ])
      .$if(!!sub, (qb) => qb.where("account.sub", "=", sub!))
      .$if(!!socketId, (qb) =>
        qb
          .innerJoin("userSocket", "userSocket.userId", "user.id")
          .where("userSocket.socketId", "=", socketId!)
          .orderBy("userSocket.created", "desc")
      );

    const sessionFlat = await q.executeTakeFirst();

    return sessionFlat
      ? {
          account: {
            sub: sessionFlat.sub,
            email: sessionFlat.email,
            type: sessionFlat.type,
          },
          user: {
            handle: sessionFlat.handle,
            id: sessionFlat.id,
            name: sessionFlat.name,
            firstName: sessionFlat.firstName,
            lastName: sessionFlat.lastName,
          },
        }
      : null;
  },
  getOrPutSession: async (
    trx: Transaction<DB>,
    {
      sub,
      google,
      apple,
    }: { sub: string; apple?: AppleIdTokenType; google?: TokenPayload }
  ): Promise<Session | null> => {
    let session = await dbCommon.getSessionBy(trx, { sub });

    if (!session && (google || apple)) {
      const firstName = google?.given_name ?? "";
      const lastName = google?.family_name ?? null;
      const email = google?.email ?? apple?.email;
      const type = google ? "google" : apple ? "apple" : "";

      let handle = `${firstName}${lastName ?? ""}`.toLowerCase();

      const picture = google?.picture ?? null;

      const existingHandles = await trx
        .selectFrom("user")
        .select((s) => s.fn.count("id").as("count"))
        .where("handle", "=", handle)
        .executeTakeFirstOrThrow();
      const floatCount = parseFloat(existingHandles.count as string);

      if (floatCount > 0) handle = `${handle}${floatCount + 1}`;

      const { id: userId } = await trx
        .insertInto("user")
        .values({ handle, firstName, lastName, picture })
        .returning("user.id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("account")
        .values({ sub, type, userId, email })
        .execute();

      session = await dbCommon.getSessionBy(trx, { sub });
    }

    return session;
  },
  getUsersBaseQuery: (trx: Transaction<DB>, userId: number | null) => {
    return trx
      .selectFrom(["user as u"])
      .leftJoin("friend as self", (join) =>
        join.on("self.userId", "=", userId).onRef("self.friendId", "=", "u.id")
      )
      .leftJoin("friend as other", (join) =>
        join
          .onRef("other.userId", "=", "u.id")
          .on("other.friendId", "=", userId)
      )
      .select(["u.handle", "u.id"])
      .select(
        sql<boolean>`case 
                when self.user_id is not null then true else false end
            `.as("self")
      )
      .select(
        sql<boolean>`case 
                when other.user_id is not null then true else false end
            `.as("other")
      )
      .$if(!!userId, (qb) => qb.where("u.id", "<>", userId));
  },
  getShareUsers: (trx: Transaction<DB>, userId: number, postId: number) => {
    const q = dbCommon
      .getUsersBaseQuery(trx, userId)
      .leftJoin("userPost as up", (join) =>
        join
          .on("up.postId", "=", postId)
          .onRef("up.userId", "=", "u.id")
          .on("up.relation", "<>", "owner")
      )
      .select(
        sql<boolean>`case
                when up.user_id is not null then true else false end
            `.as("shared")
      )
      .where("self.userId", "is not", null)
      .where("other.userId", "is not", null);

    return q.execute();
  },
  getUsersWithStatus: (
    trx: Transaction<DB>,
    userId: number | null = null,
    filter: UsersFilter = "all",
    searchTerm = ""
  ) => {
    const q = dbCommon
      .getUsersBaseQuery(trx, userId)
      .where("u.handle", "ilike", `%${searchTerm}%`);

    return q.execute();
  },
  getPost: async (trx: Transaction<DB>, postId: number, userId: number) => {
    const details: Returns.PostDetails = await trx
      .selectFrom("post as outer")
      .select((sq) => [
        //#region post
        jsonObjectFrom(
          sq
            .selectFrom("post")
            .select([
              "post.id",
              "post.created",
              "post.description",
              "post.placeId",
            ])
            .whereRef("post.id", "=", "outer.id")
        ).as("post"),
        //#region place
        jsonObjectFrom(
          sq
            .selectFrom("place as subPlace")
            .select([
              "subPlace.id",
              "subPlace.name",
              "subPlace.street",
              "subPlace.city",
              "subPlace.country",
              "subPlace.email",
              "subPlace.instagram",
              "subPlace.internalStatus",
              "subPlace.googlePlaceId",
              "subPlace.created",
            ])
            .whereRef("subPlace.id", "=", "outer.placeId")
        ).as("place"),
        //#endregion place
        //#endregion post
        //#region relations
        jsonArrayFrom(
          sq
            .selectFrom("userPost")
            .select("relation")
            .whereRef("userPost.postId", "=", "outer.id")
            .where("userPost.userId", "=", userId)
        ).as("relations"),
        //#endregion relations
        //#region content
        jsonArrayFrom(
          sq
            .selectFrom("postContent")
            .innerJoin("content", "content.id", "postContent.contentId")
            .select(["content.id", "content.name"])
            .whereRef("postContent.postId", "=", "outer.id")
        ).as("content"),
        //#endregion content
        //#region conversations
        jsonArrayFrom(
          sq
            .selectFrom("conversation as conversationOuter")
            .innerJoin(
              "conversationUser",
              "conversationUser.conversationId",
              "conversationOuter.id"
            )
            .select((ssq) => [
              "conversationOuter.id",
              //#region conversations.user
              jsonObjectFrom(
                ssq
                  .selectFrom("conversationUser")
                  .innerJoin("user", "user.id", "conversationUser.userId")
                  .select(["user.id", "user.handle"])
                  .where("conversationUser.userId", "<>", userId)
                  .whereRef(
                    "conversationUser.conversationId",
                    "=",
                    "conversationOuter.id"
                  )
              ).as("user"),
              //#endregion conversations.user
            ])
            .whereRef("conversationOuter.postId", "=", "outer.id")
            .where("conversationUser.userId", "=", userId)
        ).as("conversations"),
        //#endregion conversations
      ])
      .where("outer.id", "=", postId)
      .executeTakeFirstOrThrow();

    /*
             //#region conversations.messages
                        jsonArrayFrom(
                            ssq.selectFrom('message as messageOuter')
                            .select(sssq => [
                                //#region conversations.messages.message
                                jsonObjectFrom(
                                    sssq.selectFrom('message')
                                    .select(['message.id', 'message.text', 'message.created', 'message.userId', 'message.conversationId'])
                                    .whereRef('message.id', '=', 'messageOuter.id')
                                ).as('message'),
                                //#endregion conversations.messages.message
                                //#region conversations.messages.user
                                jsonObjectFrom(
                                    sssq.selectFrom('user')
                                    .select(['user.id', 'user.handle'])
                                    .whereRef('user.id', '=', 'messageOuter.userId')
                                ).as('user'),
                                //#endregion conversations.messages.user
                            ])
                            .whereRef('messageOuter.conversationId', '=', 'conversationOuter.id')
                        ).as('messages')
                        //#endregion conversations.messages
             */

    return details;
  },
};

export enum ErrorCode {
  ResourceNotFound,
  PathNotFound,
  HandlerNotFound,
  DomainNotFound,
  UserSessionInvalid,
  ResourcePermissions,
}

const Errors: { [k in ErrorCode]: string } = {
  [ErrorCode.ResourceNotFound]: "Resource not found",
  [ErrorCode.PathNotFound]: "Path not found",
  [ErrorCode.HandlerNotFound]: "Handler not found",
  [ErrorCode.DomainNotFound]: "Domain not found",
  [ErrorCode.UserSessionInvalid]: "User session not found",
  [ErrorCode.ResourcePermissions]:
    "User missing permissions for the requested resource",
};

export class ApiError extends Error {
  public message: string;
  public statusCode: number;
  constructor(public errorCode: ErrorCode) {
    super();

    switch (errorCode) {
      case ErrorCode.ResourceNotFound:
      case ErrorCode.PathNotFound:
      case ErrorCode.HandlerNotFound:
      case ErrorCode.DomainNotFound:
        this.statusCode = 404;
        break;

      case ErrorCode.UserSessionInvalid:
        this.statusCode = 401;
        break;
      case ErrorCode.ResourcePermissions:
        this.statusCode = 403;
        break;

      default:
        this.statusCode = 500;
    }

    this.message =
      Errors[errorCode] ??
      "An unknown server error has occured, and the dev team has been automatically notified";
  }
}
