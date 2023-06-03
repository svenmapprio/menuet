import {Pool} from 'pg';
import { Emitter, PostgresEmitterOptions } from "@socket.io/postgres-emitter";
import {
    CamelCasePlugin,
    Kysely,
    PostgresDialect,
    sql,
    Transaction
} from 'kysely'
import { Emission, EmissionWrapper, Session } from './types';
import { TokenPayload } from 'google-auth-library';
import { NextRequest } from 'next/server';
import { DB } from './tables';
import { cookies } from 'next/headers';

const dbPool = new Pool({
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_DB,
    port: parseInt(process.env.DATABASE_PORT ?? ''),
    password: process.env.DATABASE_PASS,
    user: process.env.DATABASE_USER,
    ssl: {rejectUnauthorized: false},
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
    try{
        const socketIdCookie = cookies().get('socketId');

        if(socketIdCookie){
            const socketId = socketIdCookie.value;
            const emissionWrap: EmissionWrapper = {isEmission: true, emissionPayload: emission, socketId};
            pgEmitter.serverSideEmit('emission', emissionWrap);
        }
            
    }
    catch(e){
        console.log('error getting socket', e);
    }
}

export const dbCommon = {
    getSessionBy: async (trx: Transaction<DB>, {sub}: {sub: string}): Promise<Session|null> => {
        const sessionFlat = await trx.selectFrom('account')
                .innerJoin('user', 'user.id', 'account.userId')
                .select(['user.handle', 'user.id', 'user.name', 'user.firstName', 'user.lastName', 'account.email', 'account.sub', 'account.type', 'account.userId'])
                .where('account.sub', '=', sub)
                .executeTakeFirst();

        return sessionFlat ? {account: {sub, email: sessionFlat.email, type: sessionFlat.type},user: {handle: sessionFlat.handle, id:  sessionFlat.id, name:sessionFlat.name, firstName: sessionFlat.firstName, lastName: sessionFlat.lastName}} : null;
    },
    getOrPutSession: async (trx: Transaction<DB>, {sub, google}: {sub: string, google?: TokenPayload}): Promise<Session|null> => {
        let session = await dbCommon.getSessionBy(trx, {sub});

        if(!session && google){
            const {id: userId} = await trx.insertInto('user')
                .values({handle: '', firstName: google.given_name ?? '', lastName: google.family_name ?? null})
                .returning('user.id')
                .executeTakeFirstOrThrow();

            await trx.insertInto('account')
                .values({sub, type: 'google', userId, email: google.email})
                .execute();

            session = await dbCommon.getSessionBy(trx, {sub});
        }

        return session;
    },
    getUsersWithStatus: async(trx: Transaction<DB>, userId: number | null = null, filter = '') => {
        const q = trx.selectFrom(['user as u'])
            .leftJoin('user as uu', join => join.on('uu.id', '=', userId))
            .leftJoin('friend as self', join => (
                join
                    .on('self.userId', '=', userId)
                    .onRef('self.friendId', '=', 'u.id')
            ))
            .leftJoin('friend as other', join => (
                join
                    .onRef('other.userId', '=', 'u.id')
                    .on('other.friendId', '=', userId)
            ))
            .select(['u.handle', 'u.id'])
            .select(sql<boolean>`case 
                when self.user_id is not null then true else false end
            `.as('self'))
            .select(sql<boolean>`case 
                when other.user_id is not null then true else false end
            `.as('other'))
            .where('u.handle', 'ilike', `%${filter}%`)
            .where('u.id', '<>', userId);

        const users = await q.execute();

        return users;
    }
}


export enum ErrorCode {
    ResourceNotFound,
    PathNotFound,
    HandlerNotFound,
    DomainNotFound,
    UserSessionInvalid,
    ResourcePermissions,
}

const Errors: {[k in ErrorCode]: string} = {
    [ErrorCode.ResourceNotFound]: 'Resource not found',
    [ErrorCode.PathNotFound]: 'Path not found',
    [ErrorCode.HandlerNotFound]: 'Handler not found',
    [ErrorCode.DomainNotFound]: 'Domain not found',
    [ErrorCode.UserSessionInvalid]: 'User session not found',
    [ErrorCode.ResourcePermissions]: 'User missing permissions for the requested resource',
}

export class ApiError extends Error{
    public message: string;
    public statusCode: number;
    constructor(public errorCode: ErrorCode){
        super();
        
        switch(errorCode){
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

        this.message = Errors[errorCode] ?? 'An unknown server error has occured, and the dev team has been automatically notified';
    }
}