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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
try {
    (0, dotenv_1.config)({ path: `${__dirname}/../.env.local` });
}
catch (e) {
    console.log("env local error", e);
}
const socket_io_1 = require("socket.io");
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const postgres_adapter_1 = require("@socket.io/postgres-adapter");
const helpers_1 = require("../utils/helpers");
const db_1 = require("../utils/db");
const axios_1 = __importDefault(require("axios"));
const state = {
    connected: false,
    restarting: false,
    counter: 0,
};
const app = (0, express_1.default)();
app.get("/connection", (req, res) => {
    res.send(state.connected);
});
app.get("/ready", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("ready check");
    try {
        yield axios_1.default.get("http://localhost:3000/api/ready");
        if (!state.connected)
            throw "socket not ready";
    }
    catch (e) {
        console.log("not ready", e);
        res.status(503).send();
    }
    res.status(200).send();
}));
const server = app.listen(4010);
const online = () => __awaiter(void 0, void 0, void 0, function* () { return axios_1.default.get("https:/8.8.8.8"); });
const startSocket = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("initiating socket.io");
    console.log("checking online status");
    state.connected = false;
    yield new Promise((res) => setTimeout(res, 5000));
    yield (0, helpers_1.waitUntil)(online, 1000);
    console.log("server is online");
    const pool = new pg_1.Pool({
        host: process.env.DATABASE_HOST,
        database: process.env.DATABASE_LISTEN_DB,
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
    console.log("connecting to database");
    const client = yield (0, helpers_1.waitUntil)(() => pool.connect());
    console.log("got connection to database");
    yield client.query(`
        CREATE TABLE IF NOT EXISTS socket_io_attachments (
            id          bigserial UNIQUE,
            created_at  timestamptz DEFAULT NOW(),
            payload     bytea
        );
    `);
    client.release();
    const io = new socket_io_1.Server();
    const adapter = io.adapter((0, postgres_adapter_1.createAdapter)(pool, {
        errorHandler: (e) => __awaiter(void 0, void 0, void 0, function* () {
            console.log(e.message);
            process.exit();
        }),
        heartbeatInterval: 500,
        heartbeatTimeout: 60000,
    }));
    adapter.listen(4000);
    yield new Promise((res) => __awaiter(void 0, void 0, void 0, function* () {
        adapter.on("connection", (socket) => __awaiter(void 0, void 0, void 0, function* () {
            console.log("got adapter connection", socket.id);
            socket.on("query", (q) => __awaiter(void 0, void 0, void 0, function* () {
                if (!q.isQuery) {
                    console.warn("Non query payload sent to query channel, ignoring");
                    return;
                }
                const query = yield queryHandlers[q.queryPayload.type](socket.id, q.queryPayload.data);
                const response = {
                    queryId: q.queryId,
                    data: query,
                };
                db_1.pgEmitter.to(socket.id).emit(`response_${q.queryId}`, response);
            }));
            socket.on("userId", (userId) => __awaiter(void 0, void 0, void 0, function* () {
                console.log("got userId", socket.id, userId);
                yield db_1.db.transaction().execute((trx) => __awaiter(void 0, void 0, void 0, function* () {
                    yield trx
                        .deleteFrom("userSocket")
                        .where("socketId", "=", socket.id)
                        .execute();
                    yield trx
                        .insertInto("userSocket")
                        .values({ socketId: socket.id, userId: userId })
                        .execute();
                }));
                socket.join(userId.toString());
            }));
        }));
        adapter.on("disconnection", (e) => {
            console.log("got disconnection", e);
        });
        adapter.on("disconnect", (e) => {
            console.log("got adapter disconnect", e);
        });
        adapter.on("startup", (e) => {
            state.connected = true;
            console.log("got startup event", e);
        });
        res();
    }));
    setTimeout(() => {
        console.log("emitting server side startup message");
        db_1.pgEmitter.serverSideEmit("startup", `startup message, ${Date.now()}`);
    }, 1000);
});
startSocket();
process.on("SIGINT", () => {
    console.log("SIGINT");
    server.close();
    process.exit();
});
const sessions = new Map();
const queryHandlers = {
    search: (socketId, { term }) => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield db_1.db.transaction().execute((trx) => __awaiter(void 0, void 0, void 0, function* () {
            const session = yield db_1.dbCommon.getSessionBy(trx, { socketId });
            return db_1.dbCommon.getUsers(trx, session === null || session === void 0 ? void 0 : session.user.id, term);
        }));
        return res;
    }),
};
