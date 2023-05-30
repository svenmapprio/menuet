import { db, dbCommon, emitServer } from "@/utils/db";
import { Session } from "@/utils/types";
import { OAuth2Client } from "google-auth-library";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID; 
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const scope = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : 'https://menuet-1-fljcfjbucq-ew.a.run.app';
const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, scope);

const setRefreshTokenCookie = (newHeaders: Record<string, string>, refreshToken: string) => {
    newHeaders['Set-Cookie'] = `refresh_token=${refreshToken};Secure; HttpOnly; SameSite=None; Path=/; Max-Age=99999999;`;
}

const getCodeTicket = async (newHeaders: Record<string, string>) => {
    const code = headers().get('authorization')?.substring(7);

    if(!code) return;

    const token = await client.getToken(code);

    if(!token) return;

    setRefreshTokenCookie(newHeaders, token.tokens.refresh_token ?? '');

    const idToken = token.tokens.id_token;

    if(!idToken) return;

    return await getTicket(idToken);
}

const getCookieTicket = async () => {
    const idToken = cookies().get('g_csrf_token')?.value;

    if(!idToken) return;

    return await getTicket(idToken);
};

const getRefreshTicket = async (newHeaders: Record<string, string>) => {
    const refreshToken = cookies().get('refresh_token')?.value;

    if(!refreshToken) return;
    
    client.setCredentials({refresh_token: refreshToken});

    const token = await client.refreshAccessToken();

    if(!token) return;

    const idToken = token.credentials.id_token;

    if(!idToken) return;

    setRefreshTokenCookie(newHeaders, token.credentials.refresh_token ?? '');

    return await getTicket(idToken);
}

const getTicket = async (idToken: string) => {
    try{
        return await client.verifyIdToken({
            idToken: idToken,
            audience: CLIENT_ID
        });
    }
    catch(e){
        console.log(e);
    }
}

const getPayload = async (newHeaders: Record<string, string>) => {
    const ticket = await getCodeTicket(newHeaders) ?? 
        await getCookieTicket() ?? 
        await getRefreshTicket(newHeaders);

    return ticket?.getPayload();
}

export const getSession = async (newHeaders: Record<string, string>): Promise<Session|null> => {
    const code = headers().get('authorization')?.substring(7);
    try{
        const payload = await getPayload(newHeaders);
        const sub = payload?.sub;
        
        const session = await db.transaction().execute(async trx => sub ? await dbCommon.getOrPutSession(trx, {sub, google: code ? payload : undefined}) : null);
        
        if(session && session.user){
            emitServer({type: 'session', data: session});

            return session;
        }
    }
    catch(e){
        console.log('error', e);
    }

    return null;
}