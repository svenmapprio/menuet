import { config } from "dotenv";

try {
  config({ path: `${__dirname}/../.env.local` });
} catch (e) {
  console.log("env local error", e);
}

import { Server, Socket } from "socket.io";
import express from "express";
import { Pool } from "pg";
import { createAdapter } from "@socket.io/postgres-adapter";
import {
  Emission,
  EmissionWrapper,
  Session,
  SocketQuery,
  SocketQueryResponse,
  SocketQueryWrapper,
} from "../utils/types";
import { waitUntil } from "../utils/helpers";
import { pgEmitter, db, dbCommon } from "../utils/db";
import axios from "axios";

import puppeteer from "puppeteer";
import { load } from "cheerio";
import { BingTypes, OpenaiTypes } from "../utils/routes";
import OpenAI from "openai";

const state = {
  connected: false,
  restarting: false,
  counter: 0,
};

const app = express();

app.get("/connection", (req, res) => {
  res.send(state.connected);
});

const server = app.listen(4010);

const online = async () => axios.get("https:/8.8.8.8");

const startSocket = async () => {
  console.log("initiating socket.io");

  console.log("checking online status");

  await waitUntil(online, 1000);

  console.log("server is online");

  console.log(
    process.env.DATABASE_HOST,
    process.env.DATABASE_LISTEN_DB,
    process.env.DATABASE_PORT,
    process.env.DATABASE_PASS,
    process.env.DATABASE_USER
  );

  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_LISTEN_DB,
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

  console.log("connecting to database");

  const client = await waitUntil(() => pool.connect());

  console.log("got connection to database");

  await client.query(`
        CREATE TABLE IF NOT EXISTS socket_io_attachments (
            id          bigserial UNIQUE,
            created_at  timestamptz DEFAULT NOW(),
            payload     bytea
        );
    `);

  client.release();

  const io = new Server();

  const adapter = io.adapter(
    createAdapter(pool, {
      errorHandler: async (e) => {
        console.log(e.message);
        process.exit();
      },
      heartbeatInterval: 500,
      heartbeatTimeout: 60000,
    })
  );

  adapter.listen(4000);

  await new Promise<void>(async (res) => {
    adapter.on("connection", async (socket) => {
      console.log("got adapter connection", socket.id);

      socket.on("query", async (q: SocketQueryWrapper) => {
        if (!q.isQuery) {
          console.warn("Non query payload sent to query channel, ignoring");
          return;
        }

        const query = await queryHandlers[q.queryPayload.type](
          socket,
          q.queryPayload.data
        );
        const response: SocketQueryResponse<any> = {
          queryId: q.queryId,
          data: query,
        };

        pgEmitter.to(socket.id).emit(`response_${q.queryId}`, response);
      });
    });

    adapter.on("disconnect", (e) => {
      console.log("got adapter disconnect", e);
    });

    adapter.on("emission", (e: EmissionWrapper) => {
      console.log("got emission", e.emissionPayload.type);

      if (!e.isEmission) {
        console.warn("Non emission payload sent to emission channel, ignoring");
        return;
      }

      const socket = adapter.sockets.sockets.get(e.socketId);

      const emission = e.emissionPayload;

      if (socket)
        emissionHandlers[emission.type](socket, (emission.data ?? {}) as any);
    });

    // adapter.on('server custom event', e => console.log('from api'));

    adapter.on("startup", (e) => {
      state.connected = true;
      console.log("got startup event", e);
    });

    res();
  });

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
    pgEmitter.serverSideEmit("startup", `startup message, ${Date.now()}`);
  }, 1000);
};

startSocket();

process.on("SIGINT", () => {
  console.log("SIGINT");
  server.close();
  process.exit();
});

const sessions: Map<string, Session> = new Map();

type handlerObject<T extends Emission | SocketQuery> = {
  [k in T["type"]]: (
    socket: Socket,
    d: T extends { type: k; data: infer data } ? data : never
  ) => T extends SocketQuery ? Promise<SocketQuery["returns"]> : void;
};

const emissionHandlers: handlerObject<Emission> = {
  session: (socket, session) => {
    socket.join(session.user.id.toString());

    sessions.set(socket.id, session);
  },
  groupJoin: ({}) => {},
  connectionCheck: ({}) => {},
  generatePlace: async (socket, { description, placeId }) => {
    const getWebsite = async ({ url }: { url: string }) => {
      try {
        console.log("getting website", url);

        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        await page.goto(url);

        await page.setViewport({ width: 2000, height: 1000 });

        await Promise.all([
          page.waitForNetworkIdle(),
          new Promise<void>((res) => setTimeout(res, 10000)),
        ]);

        const htmlStr = await page.content();

        const $ = load(htmlStr);

        return $("p, a").text().trim();
      } catch {
        return "";
      }
    };

    const queryBing = async ({ query }: { query: string }) => {
      console.log("querying bing", query);

      const apiKey = process.env.BING_API_KEY;
      const endpoint = "https://api.bing.microsoft.com/v7.0/search";

      const res = await axios.get<BingTypes.SearchResponse>(endpoint, {
        params: {
          q: query,
        },
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
        },
      });

      return res.data;
    };

    const openai = new OpenAI();

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

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a helpful assistant designed to output JSON. Provided a description of a place such as "Lille Petra, Kronprinsessegade, Copenhagen, Denmark", you first do a bing search to get the most recent information about the place, and then follow the instructions provided by the user to provide a complete answer from the search results. If any of the search results are relevant, but you require more info from them, you can request to load the page from the provided url.`,
      },
      { role: "user", content: content },
    ];

    const request = async () =>
      await openai.chat.completions.create({
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
              description:
                "Use this function to search the internet for the most relevant resources about a place. Input should be a search query string. Output will be a list of webpages, with snippets and other superficial info. They contain urls that can be used for further info.",
              parameters: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description:
                      "Query string for bing to use to get search results",
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
              description:
                "Use this function to search a website for information. Some websites will not return useful content, and in that case you will have to fall back to the snippets from the bing search results that this was based on. The text returned is a scrape, meaning it will not be formatted, and likely hard to read.",
              parameters: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    description:
                      "Url of the website to be downloaded for further information",
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

    let reply: string | null = null;

    const getNewCompletion = async () => {
      console.log("getting new completion");
      const completion = await request();
      const toolCalls = completion.choices[0].message.tool_calls ?? [];
      const message = completion.choices[0].message;

      messages.push(message);

      for (let i = 0; i < toolCalls.length; i++) {
        const toolCall = toolCalls[i];

        switch (toolCall.function.name) {
          case "search_website_for_information":
            const websiteResult = await getWebsite(
              JSON.parse(toolCall.function.arguments)
            );

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: websiteResult,
            });
            break;
          case "search_bing_for_information":
            const searchResults = await queryBing(
              JSON.parse(toolCall.function.arguments)
            );

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
    };

    console.log("generating place");

    await db.transaction().execute(async (trx) => {
      try {
        await trx
          .updateTable("place")
          .set({ internalStatus: "generating" })
          .where("id", "=", placeId)
          .execute();

        pgEmitter.emit("mutation", ["place", placeId]);

        while (await getNewCompletion());

        const data = JSON.parse(reply!) as OpenaiTypes.Place;

        for (let i = 0; i < data.description.length; i++) {
          const paragraph = data.description[i];

          const paragraphInsert = await trx
            .insertInto("paragraph")
            .values({
              ownerId: placeId,
              text: paragraph.text,
              type: "place_description",
            })
            .returning("id")
            .executeTakeFirstOrThrow();

          for (let j = 0; j < paragraph.sources.length; j++) {
            await trx
              .insertInto("paragraphUrl")
              .values({
                paragraphId: paragraphInsert.id,
                url: paragraph.sources[j],
              })
              .executeTakeFirstOrThrow();
          }
        }

        await trx
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

        pgEmitter.emit("mutation", ["place", placeId]);
      } catch {
        await trx
          .updateTable("place")
          .set({ internalStatus: "generation_failed" })
          .where("id", "=", placeId)
          .execute();

        pgEmitter.emit("mutation", ["place", placeId]);
      }
    });
  },
};

const queryHandlers: handlerObject<SocketQuery> = {
  search: async (socket, { term }) => {
    const session = sessions.get(socket.id);

    const res = await db.transaction().execute(async (trx) => {
      return dbCommon.getUsersWithStatus(trx, session?.user.id, "all", term);
    });

    return res;
  },
};
