import { Transaction } from "kysely";
import { NextRequest } from "next/server";
import { Session } from "./returnTypes";
import { DB } from "./tables";

export type RouteInfo<
  Args extends object | void = object,
  Returns extends unknown = void
> = {
  args: Args;
  returns: Returns;
};

export interface UserRouteInfo<
  Args extends object | void = void,
  Returns extends unknown = void
> extends RouteInfo<Args, Returns> {
  type: "sessioned";
}

export type ActionRoutes = { [k in string]: RouteInfo<any, any> };
export type ActionRouteGuards = { [k in string]: RouteInfo<any, any> };

export type Actions = "get" | "put" | "delete";

export type Routes = {
  [k in Actions]: ActionRoutes;
};

export type RouteHandler<T extends RouteInfo<any, any>, Extra> = (
  args: {
    session: T extends UserRouteInfo<any, any> ? Session : Session | null;
  } & (Extra extends void
    ? T["args"]
    : T["args"] extends void
    ? Extra
    : T["args"] & Extra)
) => Promise<T["returns"]>;

export type RouteHandlerGuard<T extends RouteInfo<any, any>, Extra> = (
  args: Extra extends void ? T["args"] : T["args"] & Extra
) => Promise<void>;

export type RouteHandlerObject<AR extends ActionRoutes, Extra> = {
  [H in keyof AR]: RouteHandler<AR[H], Extra>;
};

export type RouteHandlerGuardObject<AR extends ActionRouteGuards, Extra> = {
  [H in keyof AR]?: RouteHandlerGuard<AR[H], Extra>;
};

export type RouteHandlers<R extends Routes> = {
  [A in Actions]: RouteHandlerObject<
    R[A],
    {
      // session: Session | null;
      trx: Transaction<DB>;
      req: NextRequest;
      headers: Record<string, string>;
    }
  >;
};

export type RouteGuards<R extends Routes> = {
  [A in Actions]: RouteHandlerGuardObject<
    R[A],
    {
      session: Session;
      trx: Transaction<DB>;
      req: NextRequest;
      headers: Record<string, string>;
    }
  >;
};
