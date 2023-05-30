import { Selectable } from "kysely";
import { NextApiRequest, NextApiResponse } from "next";
import { Account, User } from "./tables";
export type Session = {
    account: Pick<Selectable<Account>, 'email' | 'type' | 'sub'>;
    user: Pick<Selectable<User>, 'name' | 'handle' | 'id'>;
};
export type FriendStatus = 'both' | 'self' | 'other' | 'none';
export type UsersListItem = Pick<Selectable<User>, 'handle' | 'id'> & {
    status: FriendStatus;
};
export type RouteGuard = (session: Session) => Promise<boolean>;
export type RouteInfo<Args extends object | void = object, Returns extends unknown = void> = {
    args: Args;
    returns: Returns;
    guard?: RouteGuard;
};
export interface UserRouteInfo<Args extends object | undefined, Returns extends unknown> extends RouteInfo<Args, Returns> {
    args: Args & {
        session: Session;
    };
}
export type ActionRoutes = {
    [k in string]: RouteInfo<any, any>;
};
export type Actions = 'get' | 'put' | 'delete';
export type Routes = {
    [k in Actions]: ActionRoutes;
};
export type RouteHandler<T extends RouteInfo<any, any>, Extra> = (args: Extra extends void ? T['args'] : T['args'] & Extra) => Promise<T['returns']>;
export type RouteHandlerObject<AR extends ActionRoutes, Extra> = {
    [H in keyof AR]: RouteHandler<AR[H], Extra>;
};
export type RouteHandlers<R extends Routes, Extra extends object | void = void> = {
    [A in Actions]: RouteHandlerObject<R[A], {
        req: NextApiRequest;
        res: NextApiResponse;
    } & Extra>;
};
export type SessionEmission = {
    type: 'session';
    data: Session;
};
export type GroupJoinEmission = {
    type: 'groupJoin';
    data: {
        groupId: number;
    };
};
export type ConnectionCheckEmission = {
    type: 'connectionCheck';
    data: {};
};
export type Emission = SessionEmission | GroupJoinEmission | ConnectionCheckEmission;
export type EmissionWrapper = {
    isEmission: true;
    socketId: string;
    emissionPayload: Emission;
};
