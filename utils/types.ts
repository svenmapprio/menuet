import { Selectable, Transaction } from "kysely"
import { NextRequest } from "next/server"
import { Account, DB, User } from "./tables"

export type Session = {
    account: Pick<Selectable<Account>, 'email'|'type'|'sub'>,
    user: Pick<Selectable<User>, 'name'|'handle'|'id'|'firstName'|'lastName'>
}

export type UsersListItem = Pick<Selectable<User>, 'handle'|'id'> & {self: boolean, other: boolean};

export type RouteInfo<Args extends object | void = object, Returns extends unknown = void> = {
    args: Args,
    returns: Returns,
}

export interface UserRouteInfo<Args extends object | undefined, Returns extends unknown> extends RouteInfo<Args, Returns>{
    args: Args & {session: Session}
}

export type ActionRoutes = {[k in string]: RouteInfo<any, any>};
export type ActionRouteGuards = {[k in string]: RouteInfo<any, any>};

export type Actions = 'get' | 'put' | 'delete';

export type Routes = {
    [k in Actions]: ActionRoutes
}

export type RouteHandler<T extends RouteInfo<any, any>, Extra> = (args: Extra extends void ? T['args'] : T['args'] & Extra) => Promise<T['returns']>;
export type RouteHandlerGuard<T extends RouteInfo<any, any>, Extra> = (args: Extra extends void ? T['args'] : T['args'] & Extra) => Promise<void>;

export type RouteHandlerObject<AR extends ActionRoutes, Extra> = {
    [H in keyof AR]: RouteHandler<AR[H], Extra>
}

export type RouteHandlerGuardObject<AR extends ActionRouteGuards, Extra> = {
    [H in keyof AR]?: RouteHandlerGuard<AR[H], Extra>
}

export type RouteHandlers<R extends Routes, Extra extends object | void = void> = {
    [A in Actions]: RouteHandlerObject<R[A], {session: Session, trx: Transaction<DB>, req: NextRequest, headers: Record<string, string>}>;
};

export type RouteGuards<R extends Routes, Extra extends object | void = void> = {
    [A in Actions]: RouteHandlerGuardObject<R[A], {session: Session, trx: Transaction<DB>, req: NextRequest, headers: Record<string, string>}>;
};

export type SessionEmission = {type: 'session', data: Session}
export type GroupJoinEmission = {type: 'groupJoin', data: {groupId: number}}
export type ConnectionCheckEmission = {type: 'connectionCheck', data: {}}
export type Emission = SessionEmission|GroupJoinEmission|ConnectionCheckEmission;
export type EmissionWrapper = {isEmission: true, socketId: string, emissionPayload: Emission};

export type UserSearchSocketQuery = {type: 'search', data: { term: string }, returns: UsersListItem[]};
export type SocketQuery = UserSearchSocketQuery;
export type SocketQueryReturns = {
    search: UserSearchSocketQuery['returns']
}
export type SocketQueryRequest = Omit<SocketQuery, 'returns'>;
export type SocketQueryWrapper = {isQuery: true, queryPayload: SocketQueryRequest, queryId: string};
export type SocketQueryResponse<T> = {queryId: string, data: T};

export type Nullable<T> = {
    [P in keyof T]: T[P] | null;
};

export type StateHook<T> = [T, (v: T) => void];

export type Rect = {top: number, bottom: number, left: number, right: number};