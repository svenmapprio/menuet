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
const puppeteer_1 = __importDefault(require("puppeteer"));
const cheerio_1 = require("cheerio");
const openai_1 = __importDefault(require("openai"));
const state = {
    connected: false,
    restarting: false,
    counter: 0,
};
const app = (0, express_1.default)();
app.get("/connection", (req, res) => {
    res.send(state.connected);
});
const server = app.listen(4010);
const online = () => __awaiter(void 0, void 0, void 0, function* () { return axios_1.default.get("https:/8.8.8.8"); });
const startSocket = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("initiating socket.io");
    console.log("checking online status");
    yield (0, helpers_1.waitUntil)(online, 1000);
    console.log("server is online");
    console.log(process.env.DATABASE_HOST, process.env.DATABASE_LISTEN_DB, process.env.DATABASE_PORT, process.env.DATABASE_PASS, process.env.DATABASE_USER);
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
                const query = yield queryHandlers[q.queryPayload.type](socket, q.queryPayload.data);
                const response = {
                    queryId: q.queryId,
                    data: query,
                };
                db_1.pgEmitter.to(socket.id).emit(`response_${q.queryId}`, response);
            }));
        }));
        adapter.on("disconnect", (e) => {
            console.log("got adapter disconnect", e);
        });
        adapter.on("emission", (e) => {
            var _a;
            console.log("got emission", e.emissionPayload.type);
            if (!e.isEmission) {
                console.warn("Non emission payload sent to emission channel, ignoring");
                return;
            }
            const socket = adapter.sockets.sockets.get(e.socketId);
            const emission = e.emissionPayload;
            if (socket)
                emissionHandlers[emission.type](socket, ((_a = emission.data) !== null && _a !== void 0 ? _a : {}));
            else
                console.log("did not find socket");
        });
        // adapter.on('server custom event', e => console.log('from api'));
        adapter.on("startup", (e) => {
            state.connected = true;
            console.log("got startup event", e);
        });
        res();
    }));
    state.connected = true;
    // const restartSocket = async () => {
    //     console.log('restarting socket');
    //     state.restarting = true;
    //     await new Promise<void>(res => io.close(e => {console.log('io close'); res()}));
    //     // await new Promise<void>(res => server.close(e => {console.log('server close'); res()}));
    //     await startSocket();
    //     state.restarting = false;
    // };
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
const emissionHandlers = {
    session: (socket, session) => {
        socket.join(session.user.id.toString());
        sessions.set(socket.id, session);
    },
    groupJoin: ({}) => { },
    connectionCheck: ({}) => { },
    generatePlace: (socket, { description, placeId }) => __awaiter(void 0, void 0, void 0, function* () {
        const getWebsite = ({ url }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                console.log("getting website", url);
                const browser = yield puppeteer_1.default.launch({ headless: "new" });
                const page = yield browser.newPage();
                yield page.goto(url);
                yield page.setViewport({ width: 2000, height: 1000 });
                yield Promise.all([
                    page.waitForNetworkIdle(),
                    new Promise((res) => setTimeout(res, 10000)),
                ]);
                const htmlStr = yield page.content();
                const $ = (0, cheerio_1.load)(htmlStr);
                return $("p, a").text().trim();
            }
            catch (_b) {
                return "";
            }
        });
        const queryBing = ({ query }) => __awaiter(void 0, void 0, void 0, function* () {
            console.log("querying bing", query);
            const apiKey = process.env.BING_API_KEY;
            const endpoint = "https://api.bing.microsoft.com/v7.0/search";
            const res = yield axios_1.default.get(endpoint, {
                params: {
                    q: query,
                },
                headers: {
                    "Ocp-Apim-Subscription-Key": apiKey,
                },
            });
            return res.data;
        });
        const openai = new openai_1.default();
        const content = `Given this place: "${description}", can you fill out the fields of a JSON with the following typescript type:
      \`\`\`ts
      type PlaceDescriptionParagraph = {
        text: string,
        sources: string[]
      }

      type PlaceDescription = [PlaceDescriptionParagraph]

      type Place = {
        name: string,
        street: string,
        city: string,
        country: string,
        instagramHandle: string | undefined,
        businessEmail: string | undefined
        description: placeDescription
      }
      \`\`\`

      The description should be no more than 2-3 paragraphs. Thanks a lot!
      `;
        const messages = [
            {
                role: "system",
                content: `You are a helpful assistant designed to output JSON. Provided a description of a place such as "Lille Petra, Kronprinsessegade, Copenhagen, Denmark", you first do a bing search to get the most recent information about the place, and then follow the instructions provided by the user to provide a complete answer from the search results. If any of the search results are relevant, but you require more info from them, you can request to load the page from the provided url.`,
            },
            { role: "user", content: content },
        ];
        const request = () => __awaiter(void 0, void 0, void 0, function* () {
            return yield openai.chat.completions.create({
                messages,
                seed: 1,
                top_p: 0.1,
                // model: "gpt-3.5-turbo-1106",
                model: "gpt-4-1106-preview",
                tools: [
                    {
                        type: "function",
                        function: {
                            name: "search_bing_for_information",
                            description: "Use this function to search the internet for the most relevant resources about a place. Input should be a search query string. Output will be a list of webpages, with snippets and other superficial info. They contain urls that can be used for further info.",
                            parameters: {
                                type: "object",
                                properties: {
                                    query: {
                                        type: "string",
                                        description: "Query string for bing to use to get search results",
                                    },
                                },
                                required: ["query"],
                            },
                        },
                    },
                    {
                        type: "function",
                        function: {
                            name: "search_website_for_information",
                            description: "Use this function to search a website for information. Some websites will not return useful content, and in that case you will have to fall back to the snippets from the bing search results that this was based on. The text returned is a scrape, meaning it will not be formatted, and likely hard to read.",
                            parameters: {
                                type: "object",
                                properties: {
                                    url: {
                                        type: "string",
                                        description: "Url of the website to be downloaded for further information",
                                    },
                                },
                                required: ["url"],
                            },
                        },
                    },
                ],
                tool_choice: "auto",
                response_format: { type: "json_object" },
            });
        });
        let reply = null;
        const getNewCompletion = () => __awaiter(void 0, void 0, void 0, function* () {
            var _c;
            console.log("getting new completion");
            const completion = yield request();
            const toolCalls = (_c = completion.choices[0].message.tool_calls) !== null && _c !== void 0 ? _c : [];
            const message = completion.choices[0].message;
            messages.push(message);
            for (let i = 0; i < toolCalls.length; i++) {
                const toolCall = toolCalls[i];
                switch (toolCall.function.name) {
                    case "search_website_for_information":
                        const websiteResult = yield getWebsite(JSON.parse(toolCall.function.arguments));
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: websiteResult,
                        });
                        break;
                    case "search_bing_for_information":
                        const searchResults = yield queryBing(JSON.parse(toolCall.function.arguments));
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(searchResults.webPages),
                        });
                        break;
                }
            }
            reply = message.content;
            return reply === null;
        });
        console.log("generating place");
        yield db_1.db
            .updateTable("place")
            .set({ internalStatus: "generating" })
            .where("id", "=", placeId)
            .execute();
        db_1.pgEmitter.emit("mutation", ["place", placeId]);
        yield db_1.db.transaction().execute((trx) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                while (yield getNewCompletion())
                    ;
                const data = JSON.parse(reply);
                for (let i = 0; i < data.description.length; i++) {
                    const paragraph = data.description[i];
                    const paragraphInsert = yield trx
                        .insertInto("paragraph")
                        .values({
                        ownerId: placeId,
                        text: paragraph.text,
                        type: "place_description",
                    })
                        .returning("id")
                        .executeTakeFirstOrThrow();
                    for (let j = 0; j < paragraph.sources.length; j++) {
                        yield trx
                            .insertInto("paragraphUrl")
                            .values({
                            paragraphId: paragraphInsert.id,
                            url: paragraph.sources[j],
                        })
                            .executeTakeFirstOrThrow();
                    }
                }
                yield trx
                    .updateTable("place")
                    .set({
                    street: data.street,
                    city: data.city,
                    country: data.country,
                    email: data.businessEmail,
                    instagram: data.instagramHandle,
                    internalStatus: "done",
                })
                    .where("id", "=", placeId)
                    .execute();
                db_1.pgEmitter.emit("mutation", ["place", placeId]);
            }
            catch (_d) {
                yield trx
                    .updateTable("place")
                    .set({ internalStatus: "generation_failed" })
                    .where("id", "=", placeId)
                    .execute();
                db_1.pgEmitter.emit("mutation", ["place", placeId]);
            }
        }));
    }),
};
const queryHandlers = {
    search: (socket, { term }) => __awaiter(void 0, void 0, void 0, function* () {
        const session = sessions.get(socket.id);
        const res = yield db_1.db.transaction().execute((trx) => __awaiter(void 0, void 0, void 0, function* () {
            return db_1.dbCommon.getUsersWithStatus(trx, session === null || session === void 0 ? void 0 : session.user.id, "all", term);
        }));
        return res;
    }),
};
