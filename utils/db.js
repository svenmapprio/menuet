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
const dbPool = new pg_1.Pool({
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_DB,
    port: parseInt((_a = process.env.DATABASE_PORT) !== null && _a !== void 0 ? _a : ''),
    password: process.env.DATABASE_PASS,
    user: process.env.DATABASE_USER,
    ssl: { rejectUnauthorized: false },
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
        const socketIdCookie = (0, headers_1.cookies)().get('socketId');
        if (socketIdCookie) {
            const socketId = socketIdCookie.value;
            const emissionWrap = { isEmission: true, emissionPayload: emission, socketId };
            exports.pgEmitter.serverSideEmit('emission', emissionWrap);
        }
    }
    catch (e) {
        console.log('error getting socket', e);
    }
};
exports.emitServer = emitServer;
exports.dbCommon = {
    getSessionBy: (trx, { sub }) => __awaiter(void 0, void 0, void 0, function* () {
        const sessionFlat = yield trx.selectFrom('account')
            .innerJoin('user', 'user.id', 'account.userId')
            .select(['user.handle', 'user.id', 'user.name', 'user.firstName', 'user.lastName', 'account.email', 'account.sub', 'account.type', 'account.userId'])
            .where('account.sub', '=', sub)
            .executeTakeFirst();
        return sessionFlat ? { account: { sub, email: sessionFlat.email, type: sessionFlat.type }, user: { handle: sessionFlat.handle, id: sessionFlat.id, name: sessionFlat.name, firstName: sessionFlat.firstName, lastName: sessionFlat.lastName } } : null;
    }),
    getOrPutSession: (trx, { sub, google }) => __awaiter(void 0, void 0, void 0, function* () {
        var _b, _c;
        let session = yield exports.dbCommon.getSessionBy(trx, { sub });
        if (!session && google) {
            const { id: userId } = yield trx.insertInto('user')
                .values({ handle: '', firstName: (_b = google.given_name) !== null && _b !== void 0 ? _b : '', lastName: (_c = google.family_name) !== null && _c !== void 0 ? _c : null })
                .returning('user.id')
                .executeTakeFirstOrThrow();
            yield trx.insertInto('account')
                .values({ sub, type: 'google', userId, email: google.email })
                .execute();
            session = yield exports.dbCommon.getSessionBy(trx, { sub });
        }
        return session;
    }),
    getUsersWithStatus: (trx, userId = null, filter = '') => __awaiter(void 0, void 0, void 0, function* () {
        const q = trx.selectFrom(['user as u'])
            .leftJoin('user as uu', join => join.on('uu.id', '=', userId))
            .leftJoin('friend as self', join => (join
            .on('self.userId', '=', userId)
            .onRef('self.friendId', '=', 'u.id')))
            .leftJoin('friend as other', join => (join
            .onRef('other.userId', '=', 'u.id')
            .on('other.friendId', '=', userId)))
            .select(['u.handle', 'u.id'])
            .select((0, kysely_1.sql) `case 
                when self.user_id is not null then true else false end
            `.as('self'))
            .select((0, kysely_1.sql) `case 
                when other.user_id is not null then true else false end
            `.as('other'))
            .where('u.handle', 'ilike', `%${filter}%`)
            .where('u.id', '<>', userId);
        const users = yield q.execute();
        return users;
    })
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
    [ErrorCode.ResourceNotFound]: 'Resource not found',
    [ErrorCode.PathNotFound]: 'Path not found',
    [ErrorCode.HandlerNotFound]: 'Handler not found',
    [ErrorCode.DomainNotFound]: 'Domain not found',
    [ErrorCode.UserSessionInvalid]: 'User session not found',
    [ErrorCode.ResourcePermissions]: 'User missing permissions for the requested resource',
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
        this.message = (_a = Errors[errorCode]) !== null && _a !== void 0 ? _a : 'An unknown server error has occured, and the dev team has been automatically notified';
    }
}
exports.ApiError = ApiError;
