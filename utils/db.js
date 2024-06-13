"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = exports.ErrorCode = exports.dbCommon = exports.emitServer = exports.pgEmitter = exports.db = void 0;
const pg_1 = require("pg");
const postgres_emitter_1 = require("@socket.io/postgres-emitter");
const kysely_1 = require("kysely");
const headers_1 = require("next/headers");
const postgres_1 = require("kysely/helpers/postgres");
const dbPool = new pg_1.Pool({
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_DB,
    port: parseInt((_a = process.env.DATABASE_PORT) !== null && _a !== void 0 ? _a : ""),
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
exports.db = new kysely_1.Kysely({
    dialect: new kysely_1.PostgresDialect({
        pool: dbPool,
    }),
    plugins: [new kysely_1.CamelCasePlugin()],
    // log: (msg) => console.log(msg)
});
exports.pgEmitter = new postgres_emitter_1.Emitter(dbPool);
const emitServer = (emission) => {
    try {
        const socketIdCookie = (0, headers_1.cookies)().get("socketId");
        console.log("emission type", emission.type, "socketIdCookie", socketIdCookie === null || socketIdCookie === void 0 ? void 0 : socketIdCookie.value);
        if (socketIdCookie) {
            const socketId = socketIdCookie.value;
            const emissionWrap = {
                isEmission: true,
                emissionPayload: emission,
                socketId,
            };
            exports.pgEmitter.serverSideEmit("emission", emissionWrap);
        }
    }
    catch (e) {
        console.log("error getting socket", e);
    }
};
exports.emitServer = emitServer;
exports.dbCommon = {
    getSessionBy: (trx, { sub, socketId }) => __awaiter(void 0, void 0, void 0, function* () {
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
            .$if(!!sub, (qb) => qb.where("account.sub", "=", sub))
            .$if(!!socketId, (qb) => qb
            .innerJoin("userSocket", "userSocket.userId", "user.id")
            .where("userSocket.socketId", "=", socketId)
            .orderBy("userSocket.created", "desc"));
        const sessionFlat = yield q.executeTakeFirst();
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
                },
            }
            : null;
    }),
    getOrPutSession: (trx, { sub, google, apple, }) => __awaiter(void 0, void 0, void 0, function* () {
        var _b, _c, _d, _e;
        let session = yield exports.dbCommon.getSessionBy(trx, { sub });
        if (!session && (google || apple)) {
            const firstName = (_b = google === null || google === void 0 ? void 0 : google.given_name) !== null && _b !== void 0 ? _b : "";
            const lastName = (_c = google === null || google === void 0 ? void 0 : google.family_name) !== null && _c !== void 0 ? _c : null;
            const email = (_d = google === null || google === void 0 ? void 0 : google.email) !== null && _d !== void 0 ? _d : apple === null || apple === void 0 ? void 0 : apple.email;
            const type = google ? "google" : apple ? "apple" : "";
            let handle = `${firstName}${lastName !== null && lastName !== void 0 ? lastName : ""}`.toLowerCase();
            const picture = (_e = google === null || google === void 0 ? void 0 : google.picture) !== null && _e !== void 0 ? _e : null;
            const existingHandles = yield trx
                .selectFrom("user")
                .select((s) => s.fn.count("id").as("count"))
                .where("handle", "=", handle)
                .executeTakeFirstOrThrow();
            const floatCount = parseFloat(existingHandles.count);
            if (floatCount > 0)
                handle = `${handle}${floatCount + 1}`;
            const { id: userId } = yield trx
                .insertInto("user")
                .values({ handle, firstName, lastName, picture })
                .returning("user.id")
                .executeTakeFirstOrThrow();
            yield trx
                .insertInto("account")
                .values({ sub, type, userId, email })
                .execute();
            session = yield exports.dbCommon.getSessionBy(trx, { sub });
        }
        return session;
    }),
    getUsersBaseQuery: (trx, userId, searchTerm) => {
        return trx
            .selectFrom(["user as u"])
            .leftJoin("friend as self", (join) => join.on("self.userId", "=", userId).onRef("self.friendId", "=", "u.id"))
            .leftJoin("friend as other", (join) => join
            .onRef("other.userId", "=", "u.id")
            .on("other.friendId", "=", userId))
            .select((s) => [
            "u.handle",
            "u.id",
            (0, kysely_1.sql) `case 
                when self.user_id is not null then true else false end
            `.as("self"),
            (0, kysely_1.sql) `case 
                when other.user_id is not null then true else false end
            `.as("other"),
        ])
            .$if(!!userId, (qb) => qb.where("u.id", "<>", userId))
            .$if(!!searchTerm, (qb) => qb.where("u.handle", "ilike", `%${searchTerm}%`));
    },
    getShareUsers: (trx, userId, postId) => {
        const q = exports.dbCommon
            .getUsersBaseQuery(trx, userId)
            .leftJoin("userPost as up", (join) => join
            .on("up.postId", "=", postId)
            .onRef("up.userId", "=", "u.id")
            .on("up.relation", "<>", "owner"))
            .select((0, kysely_1.sql) `case
                when up.user_id is not null then true else false end
            `.as("shared"))
            .where("self.userId", "is not", null)
            .where("other.userId", "is not", null);
        return q.execute();
    },
    getUsers: (trx, userId = null, searchTerm = "") => {
        const q = exports.dbCommon.getUsersBaseQuery(trx, userId, searchTerm);
        return q.execute();
    },
    getFriendUsers: (trx, userId, term) => {
        return trx
            .selectFrom("user as u")
            .innerJoin(exports.dbCommon.getUsersBaseQuery(trx, userId, term).as("ustatus"), "ustatus.id", "u.id")
            .select(["u.id", "u.handle", "ustatus.self", "ustatus.other"])
            .where("ustatus.self", "=", true)
            .where("ustatus.other", "=", true)
            .execute();
    },
    getPost: (trx, postId, userId) => __awaiter(void 0, void 0, void 0, function* () {
        const details = yield trx
            .selectFrom("post as outer")
            .select((sq) => [
            //#region post
            (0, postgres_1.jsonObjectFrom)(sq
                .selectFrom("post")
                .select([
                "post.id",
                "post.created",
                "post.description",
                "post.placeId",
            ])
                .whereRef("post.id", "=", "outer.id"))
                .$notNull()
                .as("post"),
            //#region place
            (0, postgres_1.jsonObjectFrom)(sq
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
                .whereRef("subPlace.id", "=", "outer.placeId"))
                .$notNull()
                .as("place"),
            //#endregion place
            //#endregion post
            //#region relations
            (0, postgres_1.jsonArrayFrom)(sq
                .selectFrom("userPost")
                .select("relation")
                .whereRef("userPost.postId", "=", "outer.id")
                .where("userPost.userId", "=", userId)).as("relations"),
            //#endregion relations
            //#region content
            (0, postgres_1.jsonArrayFrom)(sq
                .selectFrom("postContent")
                .innerJoin("content", "content.id", "postContent.contentId")
                .select(["content.id", "content.name"])
                .whereRef("postContent.postId", "=", "outer.id")).as("content"),
            //#endregion content
            //#region conversations
            (0, postgres_1.jsonArrayFrom)(sq
                .selectFrom("conversation as conversationOuter")
                .innerJoin("conversationUser", "conversationUser.conversationId", "conversationOuter.id")
                .select((ssq) => [
                "conversationOuter.id",
                //#region conversations.user
                (0, postgres_1.jsonObjectFrom)(ssq
                    .selectFrom("conversationUser")
                    .innerJoin("user", "user.id", "conversationUser.userId")
                    .select(["user.id", "user.handle"])
                    .where("conversationUser.userId", "<>", userId)
                    .whereRef("conversationUser.conversationId", "=", "conversationOuter.id"))
                    .$notNull()
                    .as("user"),
                //#endregion conversations.user
            ])
                .whereRef("conversationOuter.postId", "=", "outer.id")
                .where("conversationUser.userId", "=", userId)).as("conversations"),
            //#endregion conversations
        ])
            .where("outer.id", "=", postId)
            .executeTakeFirstOrThrow();
        return details;
    }),
    sharePost: (trx, postId, userId, session) => __awaiter(void 0, void 0, void 0, function* () {
        yield trx
            .insertInto("userPost")
            .values({ userId, postId, relation: "consumer" })
            .onConflict((oc) => oc.columns(["postId", "userId", "relation"]).doNothing())
            .execute();
        let conversation = yield trx
            .selectFrom("conversation")
            .innerJoin("conversationUser as cua", (join) => join
            .onRef("cua.conversationId", "=", "conversation.id")
            .on("cua.userId", "=", session.user.id))
            .innerJoin("conversationUser as cub", (join) => join
            .onRef("cub.conversationId", "=", "conversation.id")
            .on("cub.userId", "=", userId))
            .select("conversation.id")
            .where("conversation.postId", "=", postId)
            .executeTakeFirst();
        if (!conversation) {
            conversation = yield trx
                .insertInto("conversation")
                .values({ postId })
                .returning("id")
                .executeTakeFirstOrThrow();
            yield trx
                .insertInto("conversationUser")
                .values([
                { conversationId: conversation.id, userId: session.user.id },
                { conversationId: conversation.id, userId },
            ])
                .onConflict((oc) => oc.columns(["conversationId", "userId"]).doNothing())
                .execute();
        }
        const conversationId = conversation.id;
        yield trx
            .insertInto("latestFriendConversation")
            .values({ conversationId, friendId: userId, userId: session.user.id })
            .onConflict((oc) => oc.columns(["friendId", "userId"]).doUpdateSet({ conversationId }))
            .execute();
        exports.pgEmitter
            .to(session.user.id.toString())
            .emit("mutation", ["shareUsers", postId]);
        exports.pgEmitter
            .to(userId.toString())
            .to(session.user.id.toString())
            .emit("mutation", "chats");
        exports.pgEmitter.to(session.user.id.toString()).emit("mutation", ["chat", userId]);
        exports.pgEmitter.to(userId.toString()).emit("mutation", ["chat", session.user.id]);
    }),
};
var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["ResourceNotFound"] = 0] = "ResourceNotFound";
    ErrorCode[ErrorCode["PathNotFound"] = 1] = "PathNotFound";
    ErrorCode[ErrorCode["HandlerNotFound"] = 2] = "HandlerNotFound";
    ErrorCode[ErrorCode["DomainNotFound"] = 3] = "DomainNotFound";
    ErrorCode[ErrorCode["UserSessionInvalid"] = 4] = "UserSessionInvalid";
    ErrorCode[ErrorCode["ResourcePermissions"] = 5] = "ResourcePermissions";
})(ErrorCode = exports.ErrorCode || (exports.ErrorCode = {}));
const Errors = {
    [ErrorCode.ResourceNotFound]: "Resource not found",
    [ErrorCode.PathNotFound]: "Path not found",
    [ErrorCode.HandlerNotFound]: "Handler not found",
    [ErrorCode.DomainNotFound]: "Domain not found",
    [ErrorCode.UserSessionInvalid]: "User session not found",
    [ErrorCode.ResourcePermissions]: "User missing permissions for the requested resource",
};
class ApiError extends Error {
    constructor(errorCode) {
        var _a;
        super();
        this.errorCode = errorCode;
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
            (_a = Errors[errorCode]) !== null && _a !== void 0 ? _a : "An unknown server error has occured, and the dev team has been automatically notified";
    }
}
exports.ApiError = ApiError;
