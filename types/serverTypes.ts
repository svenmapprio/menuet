import { Session, UsersListItem } from "./returnTypes";

export type SessionEmission = {
  type: "session";
  data: Session;
};
export type GroupJoinEmission = {
  type: "groupJoin";
  data: {
    groupId: number;
  };
};
export type ConnectionCheckEmission = {
  type: "connectionCheck";
  data: {};
};
export type Emission =
  | SessionEmission
  | GroupJoinEmission
  | ConnectionCheckEmission;
export type EmissionWrapper = {
  isEmission: true;
  socketId: string;
  emissionPayload: Emission;
};

export type UserSearchSocketQuery = {
  type: "search";
  data: { term: string };
  returns: UsersListItem[];
};
export type SocketQuery = UserSearchSocketQuery;
export type SocketQueryReturns = {
  search: UserSearchSocketQuery["returns"];
};
export type SocketQueryRequest = Omit<SocketQuery, "returns">;
export type SocketQueryWrapper = {
  isQuery: true;
  queryPayload: SocketQueryRequest;
  queryId: string;
};
export type SocketQueryResponse<T> = { queryId: string; data: T };
