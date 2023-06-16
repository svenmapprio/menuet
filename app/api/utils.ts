import { db, dbCommon, emitServer } from "@/utils/db";
import { Session } from "@/utils/types";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import appleSignin, { AppleIdTokenType } from 'apple-signin-auth';
import { cookies, headers } from "next/headers";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; 
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const scope = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : 'https://menuet.city';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, scope);

let _appleClientSecrect: string | null = null;
const appleClientSecret = () => {
    return _appleClientSecrect ?? (_appleClientSecrect = appleSignin.getClientSecret({
        clientID: process.env.APPLE_BUNDLE_ID!, 
        teamID: process.env.APPLE_TEAM_ID!, 
        privateKey: process.env.APPLE_PRIVATE_KEY!, 
        keyIdentifier: process.env.APPLE_PRIVATE_KEY_ID!,
    }));
}
let _appleOptions: {clientID: string, clientSecret: string, redirectUri: string} | null = null   
const appleOptions = () => {
    console.log(process.env.APPLE_BUNDLE_ID, process.env.APPLE_TEAM_ID, process.env.APPLE_PRIVATE_KEY, process.env.APPLE_PRIVATE_KEY_ID);

    return _appleOptions ?? ( _appleOptions = {
        clientID: process.env.APPLE_BUNDLE_ID!,  
        redirectUri: 'https://menuet.city',
        clientSecret: appleClientSecret()
    })
};

export const getSession = async (newHeaders: Record<string, string>): Promise<Session|null> => {
    try{
        const payload = await wrap.getPayload(newHeaders);

        const {google, apple} = payload;

        const sub = google?.sub ?? apple?.sub;
        
        const session = await db.transaction().execute(async trx => sub ? await dbCommon.getOrPutSession(trx, {sub, google, apple}) : null);
        
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

const apple = {
    handleCode: async (code: string, newHeaders: Record<string, string>) => {
        try{
            const tokenResponse = await appleSignin.getAuthorizationToken(code, appleOptions());

            const idToken = tokenResponse.id_token;

            if(!idToken) throw tokenResponse;

            setRefreshTokenCookie(newHeaders, tokenResponse.refresh_token, 'apple');

            return apple.getPayload(idToken);
        }
        catch(err){
            console.log(err);

            return null;
        }
    },
    handleRefreshToken: async (refreshToken: string) => {
        try {
            const tokens = await appleSignin.refreshAuthorizationToken(refreshToken, appleOptions());
            
            return apple.getPayload(tokens.id_token);
          } catch (err) {
            console.log(err);
            return null
          }
    },
    getPayload: async (idToken: string) => {
        try {
            const payload = await appleSignin.verifyIdToken(idToken, {
              // Optional Options for further verification - Full list can be found here https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
              //audience: process.env.APPLE_BUNDLE_ID!, // client id - can also be an array
              //nonce: 'NONCE', // nonce // Check this note if coming from React Native AS RN automatically SHA256-hashes the nonce https://github.com/invertase/react-native-apple-authentication#nonce
              // If you want to handle expiration on your own, or if you want the expired tokens decoded
              //ignoreExpiration: true, // default is false
            });

            return {apple: payload};
        } catch (err) {
            // Token is not verified
            console.log(err, idToken);

            return null;
        }
    }
}

const google = {
    handleCode: async (code: string, newHeaders: Record<string, string>) => {
        const token = await googleClient.getToken(code);
    
        if(!token) return null;
    
        setRefreshTokenCookie(newHeaders, token.tokens.refresh_token ?? '', 'google');

        const idToken = token.tokens.id_token;
    
        if(!idToken) return null;

        return await google.getPayload(idToken);
    },
    handleRefreshToken: async (refreshToken: string) => {
        googleClient.setCredentials({refresh_token: refreshToken});
    
        const token = await googleClient.refreshAccessToken();
    
        if(!token) return null;
    
        const idToken = token.credentials.id_token;
    
        if(!idToken) return null;
    
        return await google.getPayload(idToken);        
    },
    getPayload: async (idToken: string) => {
        try{
            const ticket = await googleClient.verifyIdToken({
                idToken: idToken,
                audience: GOOGLE_CLIENT_ID
            })
            const payload = ticket.getPayload();

            if(!payload) throw "payload undefined"

            return {google: payload};
        }
        catch(e){
            console.log(e);

            return null;
        }
    },
}

const testProvider = (str: string, provider: 'apple' | 'google') => {
    if(!str.startsWith(provider)) return null;

    return [provider, str.replace(provider, '')];
}

const wrap = {
    getCodePayload: async (newHeaders: Record<string, string>) => {
        const codeAndProvider = headers().get('authorization')?.substring(7);

        if(!codeAndProvider) return;

        const [provider, code] = 
            testProvider(codeAndProvider, 'apple') ?? 
            testProvider(codeAndProvider, 'google') ?? [];

        if(!code) return;

        const payload = 
            provider === 'apple' 
            ? await apple.handleCode(code, newHeaders) :
            provider === 'google'
            ? await google.handleCode(code, newHeaders) :
            null;

        return payload;
    },
    getRefreshPayload: async (newHeaders: Record<string, string>) => {
        const refreshTokenAndProvider = cookies().get('refresh_token')?.value;

        if(!refreshTokenAndProvider) return null;

        const [provider, refreshToken] = 
            testProvider(refreshTokenAndProvider, 'apple') ?? 
            testProvider(refreshTokenAndProvider, 'google') ?? [];

        if(!refreshToken) return null;

        try{
            const payload = 
                provider === 'apple' 
                ? await apple.handleRefreshToken(refreshToken) :
                provider === 'google'
                ? await google.handleRefreshToken(refreshToken) :
                null;

            return payload;
        }
        catch{
            console.log('clearing refresh token');

            setRefreshTokenCookie(newHeaders, "");

            return null
        }
    },
    getPayload: async (newHeaders: Record<string, string>): Promise<{google?: TokenPayload, apple?: AppleIdTokenType}> => (
        await wrap.getCodePayload(newHeaders) ?? 
        await wrap.getRefreshPayload(newHeaders) ??
        {}
    ),
}

const setRefreshTokenCookie = (newHeaders: Record<string, string>, refreshToken: string, provider?: 'apple' | 'google') => {
    const token = provider && refreshToken ? `${provider}${refreshToken}` : '';

    newHeaders['Set-Cookie'] = `refresh_token=${token};Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=99999999;`;
}
