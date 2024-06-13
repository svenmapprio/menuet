import { db, dbCommon } from "@/utils/db";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import appleSignin, { AppleIdTokenType } from "apple-signin-auth";
import { cookies, headers } from "next/headers";
import { Account, User, DB, OauthSession } from "@/types/tables";
import { Selectable, Transaction } from "kysely";
import { Session } from "@/types/returnTypes";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const scope =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8080"
    : "https://menuet.city";

const googleClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  scope
);

const appleClientSecret = () => {
  return appleSignin.getClientSecret({
    clientID: process.env.APPLE_BUNDLE_ID!,
    teamID: process.env.APPLE_TEAM_ID!,
    privateKey: process.env.APPLE_PRIVATE_KEY!,
    keyIdentifier: process.env.APPLE_PRIVATE_KEY_ID!,
  });
};

const appleOptions = () => {
  return {
    clientID: process.env.APPLE_BUNDLE_ID!,
    redirectUri: "http://localhost",
    clientSecret: appleClientSecret(),
  };
};

// const googleOauth = JSON.parse(process.env.GOOGLE_OAUTH_CONFIG ?? "{}");

// const redirect = process.env.NEXT_PUBLIC_API_URL;

// const googleClient = new OAuth2Client(
//   googleOauth?.web?.client_id,
//   googleOauth?.web?.client_secret,
//   redirect
// );

// const appleClientSecret = () => {
//   return appleSignin.getClientSecret({
//     clientID: process.env.APPLE_BUNDLE_ID!,
//     teamID: process.env.APPLE_TEAM_ID!,
//     privateKey: process.env.APPLE_PRIVATE_KEY!,
//     keyIdentifier: process.env.APPLE_PRIVATE_KEY_ID!,
//   });
// };

// const appleOptions = () => {
//   return {
//     clientID: process.env.APPLE_BUNDLE_ID!,
//     redirectUri: "http://localhost",
//     clientSecret: appleClientSecret(),
//   };
// };

export const getSession = async (
  newHeaders: Record<string, string>
): Promise<Session | null> => {
  try {
    const oauthSession = await getOauthSession();

    if (oauthSession) return oauthSession;

    const payload = await getSessionHelpers.getPayload(newHeaders);

    const { google, apple, account } = payload;

    const sub = account?.sub ?? google?.sub ?? apple?.sub;

    const session = await db.transaction().execute(async (trx) =>
      sub
        ? await dbCommon.getOrPutSession(trx, {
            sub,
            google,
            apple,
          })
        : null
    );

    if (session?.user) return session;
  } catch (e) {
    console.log("error", e);
  }

  return null;
};

const apple = {
  handleCode: async (code: string) => {
    try {
      const tokenResponse = await appleSignin.getAuthorizationToken(
        code,
        appleOptions()
      );

      const idToken = tokenResponse.id_token;

      if (!idToken) throw tokenResponse;

      const { id } = await db.transaction().execute((trx) =>
        trx
          .insertInto("oauthSession")
          .values({
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            provider: "apple",
          })
          .returning("id")
          .executeTakeFirstOrThrow()
      );

      const expires = new Date();

      expires.setMonth(expires.getMonth() + 6);

      cookies().set("oauth_session_id", `${id}`, {
        secure: true,
        sameSite: "strict",
        expires,
      });

      //   setRefreshTokenCookie(newHeaders, tokenResponse.refresh_token, "apple");

      return apple.getPayload(idToken);
    } catch (err) {
      console.log(err);

      return null;
    }
  },
  handleRefreshToken: async (refreshToken: string) => {
    try {
      const tokens = await appleSignin.refreshAuthorizationToken(
        refreshToken,
        appleOptions()
      );

      const idToken = tokens.id_token;

      if (!idToken) throw tokens;

      return apple.getPayload(tokens.id_token);
    } catch (err) {
      console.log(err);
      return null;
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

      return { apple: payload };
    } catch (err) {
      // Token is not verified
      console.log(err, idToken);

      return null;
    }
  },
};

const google = {
  handleCode: async (code: string) => {
    const token = await googleClient.getToken(code);

    if (!token) return null;

    const { access_token, refresh_token } = token.tokens;

    if (!access_token || !refresh_token) return null;

    const { id } = await db.transaction().execute((trx) =>
      trx
        .insertInto("oauthSession")
        .values({
          accessToken: access_token,
          refreshToken: refresh_token,
          provider: "google",
        })
        .returning("id")
        .executeTakeFirstOrThrow()
    );

    const expires = new Date();

    expires.setMonth(expires.getMonth() + 6);

    cookies().set("oauth_session_id", `${id}`, {
      secure: true,
      sameSite: "strict",
      expires,
    });

    const idToken = token.tokens.id_token;

    if (!idToken) return null;

    return await google.getPayload(idToken);
  },
  handleAccessToken: async (accessToken: string) => {
    const token = await googleClient.getTokenInfo(accessToken);

    return { google: { sub: token.sub } as TokenPayload };
  },
  handleRefreshToken: async (refreshToken: string) => {
    googleClient.setCredentials({ refresh_token: refreshToken });

    const token = await googleClient.refreshAccessToken();

    if (!token) return null;

    const idToken = token.credentials.id_token;

    setRefreshTokenCookie({}, token.credentials.refresh_token ?? "", "google");

    if (!idToken) return null;

    return await google.getPayload(idToken);
  },
  getPayload: async (idToken: string) => {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload) throw "payload undefined";

      return { google: payload };
    } catch (e) {
      console.log(e);

      return null;
    }
  },
};

const testProvider = (str: string, provider: "apple" | "google") => {
  if (!str.startsWith(provider)) return null;

  return [provider, str.replace(provider, "")];
};

export const getSessionHelpers = {
  getCodePayload: async (
    newHeaders: Record<string, string>,
    codeFromRequest?: string
  ) => {
    const codeAndProvider =
      codeFromRequest ?? headers().get("Authorization")?.substring(7);

    if (!codeAndProvider) return;

    const [provider, code] =
      testProvider(codeAndProvider, "apple") ??
      testProvider(codeAndProvider, "google") ??
      [];

    if (!code) return;

    const payload =
      provider === "apple"
        ? await apple.handleCode(code)
        : provider === "google"
        ? await google.handleCode(code)
        : null;

    return payload;
  },
  getAccessPayload: async () => {
    const accessTokenAndProvider = cookies().get("access_token")?.value;

    if (!accessTokenAndProvider) return null;

    const [provider, accessToken] =
      testProvider(accessTokenAndProvider, "apple") ??
      testProvider(accessTokenAndProvider, "google") ??
      [];

    const payload =
      provider === "google"
        ? await google.handleAccessToken(accessToken)
        : null;

    return payload;
  },
  getRefreshPayload: async (newHeaders: Record<string, string>) => {
    const refreshTokenAndProvider = cookies().get("refresh_token")?.value;

    if (!refreshTokenAndProvider) return null;

    const [provider, refreshToken] =
      testProvider(refreshTokenAndProvider, "apple") ??
      testProvider(refreshTokenAndProvider, "google") ??
      [];

    if (!refreshToken) return null;

    try {
      const payload =
        provider === "apple"
          ? await apple.handleRefreshToken(refreshToken)
          : provider === "google"
          ? await google.handleRefreshToken(refreshToken)
          : null;

      console.log("got refresh payload");

      return payload;
    } catch (e) {
      console.log("clearing refresh token");

      setRefreshTokenCookie(newHeaders, "");

      return null;
    }
  },
  getPayload: async (
    newHeaders: Record<string, string>
  ): Promise<{
    account?: Pick<Account, "sub">;
    google?: TokenPayload;
    apple?: AppleIdTokenType;
  }> => (await getSessionHelpers.getCodePayload(newHeaders)) ?? {},
};

const setRefreshTokenCookie = (
  newHeaders: Record<string, string>,
  refreshToken: string,
  provider?: "apple" | "google"
) => {
  const token = provider && refreshToken ? `${provider}${refreshToken}` : "";

  cookies().set(
    "refresh_token",
    `${token};Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=99999999;`
  );

  newHeaders[
    "Set-Cookie"
  ] = `refresh_token=${token};Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=99999999;`;
};

export const deleteCookie = (
  newHeaders: Record<string, string>,
  key: string
) => {
  newHeaders[
    "Set-Cookie"
  ] = `${key}=unset;Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0;`;
};

const getAppleOauthSession = async (
  trx: Transaction<DB>,
  { id, accessToken, refreshToken }: Selectable<OauthSession>
) => {
  try {
    const res = await appleSignin.refreshAuthorizationToken(
      refreshToken,
      appleOptions()
    );

    await trx
      .updateTable("oauthSession")
      .set({ accessToken: res.access_token, refreshToken: res.refresh_token })
      .where("id", "=", id)
      .execute();

    const { sub } = await appleSignin.verifyIdToken(res.id_token);

    return await dbCommon.getSessionBy(trx, { sub });
  } catch {
    return null;
  }
};

const getGoogleOauthSession = async (
  trx: Transaction<DB>,
  { id, accessToken, refreshToken }: Selectable<OauthSession>
) => {
  try {
    const { sub } = await googleClient.getTokenInfo(accessToken);

    if (!sub) throw "token invalid";

    return await dbCommon.getSessionBy(trx, { sub });
  } catch {
    googleClient.setCredentials({ refresh_token: refreshToken });

    const newTokens = await googleClient.refreshAccessToken();

    if (!newTokens) return null;

    const { access_token, refresh_token } = newTokens.credentials;

    if (!access_token || !refresh_token) return null;

    await trx
      .updateTable("oauthSession")
      .set({ accessToken: access_token, refreshToken: refresh_token })
      .where("id", "=", id)
      .execute();

    const { sub } = await googleClient.getTokenInfo(access_token);

    if (!sub) return null;

    console.log("got oauth refresh session");

    return await dbCommon.getSessionBy(trx, { sub });
  }
};

const getOauthSession = async () => {
  const id = cookies().get("oauth_session_id")?.value;

  if (!id) return null;

  return await db.transaction().execute(async (trx) => {
    const oauthSession = await trx
      .selectFrom("oauthSession")
      .select([
        "oauthSession.created",
        "oauthSession.id",
        "oauthSession.accessToken",
        "oauthSession.refreshToken",
        "oauthSession.provider",
      ])
      .where("oauthSession.id", "=", id)
      .executeTakeFirst();

    if (!oauthSession) return null;

    switch (oauthSession.provider) {
      case "google":
        return await getGoogleOauthSession(trx, oauthSession);
      case "apple":
        return await getAppleOauthSession(trx, oauthSession);
    }
  });
};
