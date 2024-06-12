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
          socket.id,
          q.queryPayload.data
        );
        const response: SocketQueryResponse<any> = {
          queryId: q.queryId,
          data: query,
        };

        pgEmitter.to(socket.id).emit(`response_${q.queryId}`, response);
      });

      socket.on("userId", async (userId: number) => {
        console.log("got userId", socket.id, userId);
        await db.transaction().execute(async (trx) => {
          await trx
            .deleteFrom("userSocket")
            .where("socketId", "=", socket.id)
            .execute();

          await trx
            .insertInto("userSocket")
            .values({ socketId: socket.id, userId: userId })
            .execute();
        });

        socket.join(userId.toString());
      });
    });

    adapter.on("disconnection", (e) => {
      console.log("got disconnection", e);
    });

    adapter.on("disconnect", (e) => {
      console.log("got adapter disconnect", e);
    });

    // adapter.on("emission", (e: EmissionWrapper) => {
    //   console.log("got emission", e.emissionPayload.type);

    //   if (!e.isEmission) {
    //     console.warn("Non emission payload sent to emission channel, ignoring");
    //     return;
    //   }

    //   const emission = e.emissionPayload;

    //   emissionHandlers[emission.type](e.socketId, (emission.data ?? {}) as any);
    // });

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
    socketId: string,
    d: T extends { type: k; data: infer data } ? data : never
  ) => T extends SocketQuery ? Promise<SocketQuery["returns"]> : void;
};

const queryHandlers: handlerObject<SocketQuery> = {
  search: async (socketId, { term }) => {
    const res = await db.transaction().execute(async (trx) => {
      const session = await dbCommon.getSessionBy(trx, { socketId });

      return dbCommon.getUsers(trx, session?.user.id, term);
    });

    return res;
  },
};
