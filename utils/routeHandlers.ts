import { sql } from "kysely";
import {
  jsonBuildObject,
  jsonObjectFrom,
  jsonArrayFrom,
} from "kysely/helpers/postgres";
import { PublicRoutes } from "./routes";

import { dbCommon, pgEmitter } from "./db";
import axios from "axios";
import { spawn } from "child_process";
import { RouteHandlers } from "@/types/appRoutes";
import { GetContent, GoogleTypes } from "@/types/returnTypes";

export interface PublicRouteHandlers extends RouteHandlers<PublicRoutes> {}

export const routeHandlers: PublicRouteHandlers = {
  delete: {
    session: async ({ req, headers, session }) => {
      headers[
        "Set-Cookie"
      ] = `oauth_session_id=unset;Secure; HttpOnly; SameSite=None; Path=/; Max-Age=0;`;
    },
    friend: async ({ trx, session, userId }) => {
      const sourceUserId = session.user.id;
      const targetUserId = userId;

      if (sourceUserId !== targetUserId) {
        await trx
          .deleteFrom("friend")
          .where("friend.friendId", "=", targetUserId)
          .where("friend.userId", "=", sourceUserId)
          .execute();
      }

      const groups = pgEmitter
        .to(targetUserId.toString())
        .to(sourceUserId.toString());

      groups.emit("mutations", ["users", "friends", ["friend", targetUserId]]);
    },
    userPost: async ({ trx, postId, userId, session }) => {
      await trx
        .deleteFrom("userPost")
        .where("postId", "=", postId)
        .where("userId", "=", userId)
        .where("relation", "=", "consumer")
        .execute();

      pgEmitter
        .to(session.user.id.toString())
        .emit("mutation", ["shareUsers", postId]);
      pgEmitter
        .to(userId.toString())
        .to(session.user.id.toString())
        .emit("mutation", "chats");
      pgEmitter
        .to(session.user.id.toString())
        .emit("mutation", ["chat", userId]);
      pgEmitter
        .to(userId.toString())
        .emit("mutation", ["chat", session.user.id]);
    },
  },
  get: {
    beep: async ({ socketId, session }) => {
      session
        ? pgEmitter.to(session.user.id.toString()).emit("boop")
        : pgEmitter.to(socketId).emit("boop");
    },
    session: async ({ trx, session }) => {
      return session ?? null;
    },
    posts: async ({ trx, session }) =>
      await trx
        .selectFrom("post")
        .select((s) => [
          jsonObjectFrom(
            s
              .selectFrom("post as subPost")
              .select([
                "subPost.id",
                "subPost.created",
                "subPost.description",
                "subPost.placeId",
              ])
              .whereRef("subPost.id", "=", "post.id")
          )
            .$notNull()
            .as("post"),
          jsonObjectFrom(
            s
              .selectFrom("place as subPlace")
              .select([
                "subPlace.country",
                "subPlace.email",
                "subPlace.googlePlaceId",
                "subPlace.id",
                "subPlace.instagram",
                "subPlace.internalStatus",
                "subPlace.name",
                "subPlace.street",
                "subPlace.city",
                "subPlace.created",
              ])
              .whereRef("subPlace.id", "=", "post.placeId")
          )
            .$notNull()
            .as("place"),
          sql<GetContent[]>`array_agg(row_to_json(c) order by c.id desc)`.as(
            "content"
          ),
        ])
        .innerJoin("userPost", "userPost.postId", "post.id")
        .leftJoin("postContent as pc", (j) =>
          j.onRef("pc.postId", "=", "post.id")
        )
        .innerJoin("content as c", (j) => j.onRef("c.id", "=", "pc.contentId"))
        .where("userPost.relation", "=", "owner")
        .where("userPost.userId", "=", session.user.id)
        .groupBy("post.id")
        .execute(),
    users: async ({ trx, session, filter = "all", term }) => {
      return filter === "friend"
        ? session
          ? dbCommon.getFriendUsers(trx, session.user.id, term)
          : []
        : dbCommon.getUsers(trx, session?.user.id, term);
    },
    shareUsers: async ({ trx, session, postId }) => {
      return dbCommon.getShareUsers(trx, session.user.id, postId);
    },
    post: async ({ trx, postId, session }) => {
      return dbCommon.getPost(trx, postId, session.user.id);
    },
    content: async ({ trx, contentId }) => {
      return await trx
        .selectFrom("content")
        .select(["content.name", "content.id"])
        .where("content.id", "=", contentId)
        .executeTakeFirst();
    },
    chat: async ({ trx, userId, session }) => {
      const user = await trx
        .selectFrom("user")
        .select(["id", "handle"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();

      const conversations = await trx
        .selectFrom("conversation")
        .innerJoin("post", "post.id", "conversation.postId")
        .innerJoin("postContent", "postContent.postId", "post.id")
        .innerJoin("content", "content.id", "postContent.contentId")
        .innerJoin("conversationUser as cua", (join) =>
          join
            .on("cua.userId", "=", session.user.id)
            .onRef("cua.conversationId", "=", "conversation.id")
        )
        .innerJoin("conversationUser as cub", (join) =>
          join
            .on("cub.userId", "=", userId)
            .onRef("cub.conversationId", "=", "conversation.id")
        )
        .innerJoin("userPost as up", (join) =>
          join
            .on("up.userId", "=", session.user.id)
            .onRef("up.postId", "=", "conversation.postId")
        )
        .leftJoin("message as m", (j) =>
          j.onRef("m.conversationId", "=", "conversation.id")
        )
        .select((sq) => [
          jsonBuildObject({
            id: sq.ref("conversation.id"),
          })
            .$notNull()
            .as("conversation"),
          sql<number>`count(distinct m.id)::int`.as("messagesCount"),
          jsonObjectFrom(
            sq
              .selectFrom("post as subPost")
              .select((ssq) => [
                "subPost.id",
                "subPost.created",
                "subPost.description",
                "subPost.placeId",
                "up.relation",
                jsonObjectFrom(
                  ssq
                    .selectFrom("place as subsubPlace")
                    .select(["subsubPlace.id", "subsubPlace.name"])
                    .whereRef("subsubPlace.id", "=", "subPost.placeId")
                )
                  .$notNull()
                  .as("place"),
              ])
              .whereRef("subPost.id", "=", "post.id")
          )
            .$notNull()
            .as("post"),
          sql<
            { name: string }[]
          >`array_agg(content.name order by content.id desc)`.as("content"),
        ])
        .orderBy("post.created")
        .groupBy(["post.id", "conversation.id", "up.relation"])
        .execute();

      return { user, conversations };
    },
    chats: async ({ trx, session }) => {
      const latestConvos = trx
        .selectFrom("latestFriendConversation as lfc")
        .innerJoin("conversation", "conversation.id", "lfc.conversationId")
        .select((sq) => [
          jsonObjectFrom(
            sq
              .selectFrom("user")
              .select(["id", "handle"])
              .whereRef("user.id", "=", "lfc.friendId")
          )
            .$notNull()
            .as("user"),
          jsonObjectFrom(
            sq
              .selectFrom("post")
              .select((ssq) => [
                jsonObjectFrom(
                  ssq
                    .selectFrom("post as inner")
                    .select([
                      "inner.id",
                      "inner.description",
                      "inner.created",
                      "inner.placeId",
                      jsonObjectFrom(
                        ssq
                          .selectFrom("place as subsubPlace")
                          .select(["subsubPlace.id", "subsubPlace.name"])
                          .whereRef("subsubPlace.id", "=", "post.placeId")
                      )
                        .$notNull()
                        .as("place"),
                    ])
                    .whereRef("inner.id", "=", "post.id")
                )
                  .$notNull()
                  .as("post"),
                jsonObjectFrom(
                  ssq
                    .selectFrom("message")
                    .select([
                      "message.id",
                      "message.text",
                      "message.created",
                      "message.userId",
                    ])
                    .whereRef("message.id", "=", "conversation.latestMessageId")
                )
                  .$notNull()
                  .as("message"),
              ])
              .whereRef("post.id", "=", "conversation.postId")
          )
            .$notNull()
            .as("conversation"),
        ])
        .where("lfc.userId", "=", session.user.id);

      return await latestConvos.execute();
    },
    conversation: async ({ conversationId, trx }) => {
      const conversation = await trx
        .selectFrom("conversation")
        .select([
          "conversation.id",
          "conversation.postId",
          "conversation.created",
        ])
        .where("conversation.id", "=", conversationId)
        .executeTakeFirstOrThrow();

      //const post = await dbCommon.getPost(trx, conversation.postId, session.user.id);

      const messages = await trx
        .selectFrom("message as outer")
        .select((sq) => [
          jsonObjectFrom(
            sq
              .selectFrom("message as inner")
              .select([
                "inner.conversationId",
                "inner.created",
                "inner.id",
                "inner.text",
                "inner.userId",
              ])
              .whereRef("inner.id", "=", "outer.id")
          )
            .$notNull()
            .as("message"),
          jsonObjectFrom(
            sq
              .selectFrom("user")
              .select(["user.id", "user.handle"])
              .whereRef("user.id", "=", "outer.userId")
          )
            .$notNull()
            .as("user"),
        ])
        .where("outer.conversationId", "=", conversationId)
        .execute();

      return { conversation, messages };
    },

    places: async ({ name }) => {
      const parametersObject = {
        input: name,
        types: "food",
        radius: "1",
        // sessionToken: randomUUID(),
        key: process.env.GOOGLE_PLACES_KEY,
      };

      const parameters = Object.entries(parametersObject)
        .map(([key, value]) => `${key}=${value}`)
        .join("&");

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${parameters}`;

      const req = await axios.get<GoogleTypes.AutocompleteResponse>(url);

      return req.data.predictions;
    },

    place: async ({ trx, placeId }) =>
      await trx
        .selectFrom("place")
        .select((sub) => [
          jsonObjectFrom(
            sub
              .selectFrom("place as subPlace")
              .select([
                "city",
                "country",
                "street",
                "email",
                "googlePlaceId",
                "id",
                "instagram",
                "internalStatus",
                "name",
                "created",
              ])
              .whereRef("subPlace.id", "=", "place.id")
          )
            .$notNull()
            .as("place"),
          jsonArrayFrom(
            sub
              .selectFrom("paragraph as subParagraph")
              .select((subsub) => [
                jsonObjectFrom(
                  subsub
                    .selectFrom("paragraph as subsubParagraph")
                    .select([
                      "subsubParagraph.id",
                      "subsubParagraph.ownerId",
                      "subsubParagraph.text",
                      "subsubParagraph.type",
                    ])
                    .whereRef("subsubParagraph.id", "=", "subParagraph.id")
                )
                  .$notNull()
                  .as("paragraph"),
                jsonArrayFrom(
                  subsub
                    .selectFrom("paragraphUrl as subsubParagraphUrl")
                    .select([
                      "subsubParagraphUrl.id",
                      "subsubParagraphUrl.paragraphId",
                      "subsubParagraphUrl.url",
                    ])
                    .whereRef(
                      "subsubParagraphUrl.paragraphId",
                      "=",
                      "subParagraph.id"
                    )
                ).as("sources"),
              ])
              .whereRef("subParagraph.ownerId", "=", "place.id")
          ).as("paragraphs"),
        ])
        .where("id", "=", placeId)
        .executeTakeFirst(),
  },
  put: {
    post: async ({
      trx,
      session,
      post: { id, description, placeId },
      users = [],
      content,
    }) => {
      const insert = await trx
        .insertInto("post")
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({ description, placeId })
        )
        .values({ id, description, placeId })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("userPost")
        .values({
          postId: insert.id,
          userId: session.user.id,
          relation: "owner",
        })
        .onConflict((oc) =>
          oc.columns(["postId", "userId", "relation"]).doNothing()
        )
        .execute();

      await trx
        .deleteFrom("postContent")
        .where("postContent.postId", "=", insert.id)
        .execute();

      if (content.length) {
        await trx
          .insertInto("postContent")
          .values(content.map((c) => ({ contentId: c.id, postId: insert.id })))
          .onConflict((oc) => oc.columns(["contentId", "postId"]).doNothing())
          .execute();
      }

      await trx
        .deleteFrom("userPost")
        .where("relation", "=", "consumer")
        .where("postId", "=", insert.id)
        .where("userId", "not in", users)
        .execute();

      for (let i = 0; i < users.length; i++)
        await dbCommon.sharePost(trx, insert.id, users[i], session);

      const usersWithAccess = await trx
        .selectFrom("userPost")
        .select("userId")
        .where("relation", "=", "consumer")
        .where("postId", "=", insert.id)
        .execute();

      const emitPostMutation = (userId: number) =>
        pgEmitter.to(userId.toString()).emit("mutation", ["post", insert.id]);

      pgEmitter.to(session.user.id.toString()).emit("mutation", "posts");

      emitPostMutation(session.user.id);

      for (let i = 0; i < usersWithAccess.length; i++)
        emitPostMutation(usersWithAccess[i].userId);

      return insert;
    },
    postContent: async ({ trx, postId, contentId, session }) => {
      await trx
        .insertInto("postContent")
        .values({ contentId, postId })
        .onConflict((oc) => oc.columns(["contentId", "postId"]).doNothing())
        .execute();

      pgEmitter.to(session.user.id.toString()).emit("mutation", "post");
    },
    content: async ({ trx, session }) => {
      const insert = await trx
        .insertInto("content")
        .values({ userId: session.user.id })
        .returning("content.id")
        .executeTakeFirstOrThrow();

      return insert;
    },
    user: async ({ session, trx, user, defaultHandle }) => {
      if (!Object.keys(user).length) return;

      if (defaultHandle && typeof user.handle === "string") {
        const existingHandles = await trx
          .selectFrom("user")
          .select((s) => s.fn.count("id").as("count"))
          .where("handle", "=", user.handle)
          .executeTakeFirstOrThrow();
        const floatCount = parseFloat(existingHandles.count as string);

        if (floatCount > 0) user.handle = `${user.handle}${floatCount + 1}`;
      }

      const q = trx
        .updateTable("user")
        .set({ ...user })
        .where("id", "=", session.user.id);

      await q.execute();

      pgEmitter.to(session.user.id.toString()).emit("mutation", "session");
    },
    conversation: async ({}) => {},
    friend: async ({ trx, session, userId }) => {
      const sourceUserId = session.user.id;
      const targetUserId = userId;

      if (targetUserId === session.user.id) return;

      await trx
        .insertInto("friend")
        .values({ friendId: targetUserId, userId: sourceUserId })
        .onConflict((oc) => oc.columns(["friendId", "userId"]).doNothing())
        .execute();

      const groups = pgEmitter
        .to(targetUserId.toString())
        .to(sourceUserId.toString());

      groups.emit("mutations", ["users", "friends", ["friend", targetUserId]]);
    },
    group: async ({}) => {},
    groupConversation: async ({}) => {},
    groupMember: async ({}) => {},
    message: async ({ trx, conversationId, session, text }) => {
      const insert = await trx
        .insertInto("message")
        .values({ text, conversationId, userId: session.user.id })
        .returning(["message.id", "message.created"])
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("conversation")
        .set({ latestMessageId: insert.id })
        .where("conversation.id", "=", conversationId)
        .execute();

      const { userId } = await trx
        .selectFrom("conversationUser")
        .select("conversationUser.userId")
        .where("conversationUser.conversationId", "=", conversationId)
        .where("conversationUser.userId", "<>", session.user.id)
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("latestFriendConversation")
        .set({ conversationId })
        .where("userId", "=", session.user.id)
        .where("friendId", "=", userId)
        .execute();

      pgEmitter
        .to(userId.toString())
        .to(session.user.id.toString())
        .emit("mutation", ["conversation", conversationId]);
      pgEmitter
        .to(userId.toString())
        .to(session.user.id.toString())
        .emit("mutation", "chats");

      return { id: insert.id, created: insert.created };
    },
    place: async ({ trx, googlePlaceId, description, name, session }) => {
      const existingPlace = await trx
        .selectFrom("place")
        .select(["id", "internalStatus"])
        .where("googlePlaceId", "=", googlePlaceId)
        .executeTakeFirst();

      const internalStatus = existingPlace?.internalStatus;

      if (!!internalStatus && internalStatus !== "should_regenerate") {
        console.log("place should not generate");
        return existingPlace;
      }

      try {
        const getGooglePlace = await axios.get(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}fields=place_id&key=${process.env.GOOGLE_PLACES_KEY}`
        );

        if (getGooglePlace.status !== 200) {
          console.log("google place id invalid", googlePlaceId);
          return;
        }
      } catch {
        console.log("google place id invalid in catch", googlePlaceId);
        return;
      }

      let placeId = existingPlace?.id;

      if (!placeId) {
        const placeInsert = await trx
          .insertInto("place")
          .values({
            name: name,
            googlePlaceId: googlePlaceId,
            internalStatus: "should_regenerate",
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("userPlace")
          .values({ placeId: placeInsert.id, userId: session.user.id })
          .onConflict((oc) => oc.columns(["placeId", "userId"]).doNothing())
          .execute();

        pgEmitter.emit("mutation", ["place", placeInsert.id]);

        placeId = placeInsert.id;
      }

      const sub = spawn(
        "node",
        [
          "services/generatePlace.js",
          "--placeId",
          placeId.toString(),
          "--description",
          description,
        ],
        {
          detached: true,
        }
      );

      sub.stdout.pipe(process.stdout);
      sub.stderr.pipe(process.stdout);

      sub.unref();

      return { id: placeId };
    },
    userPost: async ({ trx, session, postId, userId }) => {
      await dbCommon.sharePost(trx, postId, userId, session);
    },
  },
};
