
import { NextRequest, NextResponse } from "next/server";
import {db, ApiError, ErrorCode} from '@/utils/db';
import axios from 'axios';
import { waitUntil } from "@/utils/helpers";
import { routeHandlers } from "@/utils/routeHandlers";
import guards from "@/utils/guards";
import { getSession } from "../../utils";

const checkEmissionConnection = async () => {
    const socketServerConnected = async () => {
        const res = await axios.get('http://localhost:4010/connection').catch(e => console.log('get connection error'));

        if(res?.data !== true)
            throw 'not connected';

        return true;
    }

    await waitUntil(socketServerConnected, 1000);
}

const handler = async (req: NextRequest, { params }: {
    params: { paths: string[], method: 'delete'|'get'|'put' }
  } ) => {
    try{
        const {paths, method} = params;
        const path = paths[0];
        const auth = paths[1];
        const body = await req.json().catch(() => {}) ?? {};

        await checkEmissionConnection();
        if(paths.length !== 1)
            throw new ApiError(ErrorCode.PathNotFound);
    
        const handler = routeHandlers[method][path as keyof typeof routeHandlers[typeof method]] as (o: any) => Promise<any>;
        const guard = guards[method][path as keyof typeof routeHandlers[typeof method]] as (o: any) => Promise<any>;
        
        if(!handler || typeof handler !== 'function')
            throw new ApiError(ErrorCode.HandlerNotFound);

        const newHeaders: Record<string, string> = {};

        const session = await getSession(newHeaders).catch(e => console.log('get session error', e));
        const data = await db.transaction().execute(async trx => {
            const args = {req, headers: newHeaders, trx, session, ...body};

            if(typeof guard === 'function')
                await guard(args);

            return await handler(args) ?? null;
        });

        return NextResponse.json({data}, {status: 200, headers: {
            'Content-Type': 'application/json',
            ...newHeaders,
        }});
    }
    catch(e: any){
        console.log('error', e);
        if(e instanceof ApiError){
            return NextResponse.json({error: e.message}, {status: e.statusCode});
            // res.statusCode = e.statusCode;
            // res.send(e.message);
        }
        else{
            return NextResponse.json({error: e}, {status: 500});
            // console.log('unhandled error', e);
            // res.statusCode = 500;
            // res.send(e);
        }
    }
}

export const POST = handler;