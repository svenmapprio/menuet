import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { PublicRoutes } from "./routes";
import { RouteInfo } from "./types";

const host = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : 'https://menuet-1-fljcfjbucq-ew.a.run.app';
// const host = 'http://localhost:8080';
export const baseUrl = `${host}/api`;

type CustomRequestInit = RequestInit & {cookies?: ReadonlyRequestCookies};

export const domains = {
    public: new Proxy({} as {[k in keyof PublicRoutes]: {[kk in keyof PublicRoutes[k]]: (arg: PublicRoutes[k][kk] extends RouteInfo<any, any> ? PublicRoutes[k][kk]['args'] : never, init?: CustomRequestInit) => Promise<PublicRoutes[k][kk] extends RouteInfo<any, any> ? PublicRoutes[k][kk]['returns'] : never>}}, {get(t, method: keyof PublicRoutes){
        return new Proxy({} as {[k in keyof PublicRoutes[typeof method]]: () => Promise<PublicRoutes[typeof method][k]['returns']>}, {get(t, path: keyof PublicRoutes[typeof method]){
            return async (args: any, init: CustomRequestInit = {}) => {
                const reqInit: RequestInit = {
                    ...init, method: 'post',
                };

                const body = args;

                reqInit.body = JSON.stringify(body);

                reqInit.headers = {"Cookie": init.cookies?.toString() ?? '', ...reqInit.headers, 'Content-Type': 'application/json'};

                const url = `${baseUrl}/${method}/${path}`;

                const res = await fetch(url, reqInit);

                const data = await res.json() as {data: PublicRoutes[typeof method][typeof path]['returns']};

                return data.data;
            };
        }})
    }}),
}
