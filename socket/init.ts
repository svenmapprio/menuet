import {Server, Socket} from 'socket.io';
import express from 'express';
import {Pool} from 'pg';
import {createAdapter} from '@socket.io/postgres-adapter';
import { Emitter } from "@socket.io/postgres-emitter";
import {Emission, EmissionWrapper} from '../utils/types';
import {waitUntil} from '../utils/helpers';
import axios from 'axios';
import {config} from 'dotenv'

const state = {
    connected: false,
    restarting: false,
    counter: 0
}

const app = express();

if(process.argv[process.argv.length - 1] === 'dev')
    config({path: '../.env.local'});

app.get('/connection', (req, res) => {
    res.send(state.connected);
});

const server = app.listen(4010);

const dbPool = new Pool({
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_DB,
    port: parseInt(process.env.DATABASE_PORT ?? ''),
    password: process.env.DATABASE_PASS,
    user: process.env.DATABASE_USER,
    ssl: {rejectUnauthorized: false}    
});

const pgEmitter = new Emitter(dbPool);

const online = async () => axios.get('https:/8.8.8.8');

const startSocket = async () => {
    console.log('initiating socket.io');
    
    console.log('checking online status');

    await waitUntil(online, 1000);

    console.log('server is online');

    const pool = new Pool({
        host: process.env.DATABASE_HOST,
        database: process.env.DATABASE_LISTEN_DB,
        port: parseInt(process.env.DATABASE_PORT ?? ''),
        password: process.env.DATABASE_PASS,
        user: process.env.DATABASE_USER,
        ssl: {rejectUnauthorized: false}  
    });

    console.log('connecting to database');

    const client = await waitUntil(() => pool.connect());

    console.log('got connection to database');

    await client.query(`
        CREATE TABLE IF NOT EXISTS socket_io_attachments (
            id          bigserial UNIQUE,
            created_at  timestamptz DEFAULT NOW(),
            payload     bytea
        );
    `);

    client.release();

    const io = new Server();

    const adapter = io.adapter(createAdapter(pool, { errorHandler: async (e) => {
        process.exit();
    }, heartbeatInterval: 500, heartbeatTimeout: 60000}));

    adapter.listen(4000);

    await new Promise<void>(async res => {
        adapter.on('connection', socket => {
            console.log('got adapter connection', socket.id);
        });

        adapter.on('disconnect', e => {
            console.log('got adapter disconnect', e);
        });

        adapter.on('emission', (e: EmissionWrapper) => {
            if(!e.isEmission){
                console.warn('Non emission payload sent to emission channel, ignoring');
                return;
            }

            const socket = adapter.sockets.sockets.get(e.socketId);

            const emission = e.emissionPayload;

            if(socket)
                emissionHandlers[emission.type](socket, (emission.data ?? {}) as any);
        });

        // adapter.on('server custom event', e => console.log('from api'));

        adapter.on('startup', e => {
            state.connected = true;
            console.log('got startup event', e);
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
        console.log('emitting server side startup message');
        pgEmitter.serverSideEmit('startup', `startup message, ${Date.now()}`);
    }, 1000);
};

startSocket();

process.on('SIGINT', () => { 
    console.log('SIGINT'); 
    server.close();
    process.exit();
});

type handlerObject<T extends Emission> = {[k in T['type']]: (socket: Socket, d: T extends {type: k, data: infer data} ? data : never) => void}

const emissionHandlers: handlerObject<Emission> = {
    session: (socket, {user}) => {
        socket.join(user.id.toString());
    },
    groupJoin: ({}) => {

    },
    connectionCheck: ({}) => {

    }
}