import { Insertable, Selectable } from "kysely";
import {
  Content,
  Conversation,
  Message,
  Post,
  User,
  UserPostRelation,
} from "./tables";
import {
  RouteInfo,
  Routes,
  Session,
  UsersListItem,
  UsersFilter,
  ShareUsersListItem,
} from "./types";

export type GetContent = Pick<Selectable<Content>, "name" | "id">;

export type PutPost = {
  post: Insertable<Post>;
  content: GetContent[];
};

export type GetMessage = {
  message: Selectable<Message>;
  user: Pick<Selectable<User>, "id" | "handle">;
};

export namespace Returns {
  export type ChatDetails = {
    user: Pick<Selectable<User>, "id" | "handle">;
    conversations: {
      conversation: Pick<Selectable<Conversation>, "id">;
      messagesCount: number;
      post: Selectable<Post> & {
        relation: UserPostRelation;
      };
      content: { name: string }[];
    }[];
  };

  export type Chats = {
    user: Pick<Selectable<User>, "id" | "handle">;
    conversation: {
      post: Selectable<Post>;
      message?: Pick<Selectable<Message>, "id" | "text" | "created" | "userId">;
    };
  }[];

  export type ConversationDetails = {
    conversation: Omit<Selectable<Conversation>, "latestMessageId">;
    messages: GetMessage[];
  };

  export type PostDetails = {
    post: Selectable<Post>;
    content: GetContent[];
    relations: { relation: UserPostRelation }[];
    conversations: {
      id: number;
      user: Pick<Selectable<User>, "id" | "handle">;
    }[];
  };

  export type PostRow = Selectable<Post> & {
    content: GetContent[];
  };
}

export interface PublicRoutes extends Routes {
  get: {
    beep: RouteInfo<{ socketId: string }>;
    session: RouteInfo<{}, Session | null>;
    users: RouteInfo<{ filter?: UsersFilter }, UsersListItem[]>;
    shareUsers: RouteInfo<{ postId: number }, ShareUsersListItem[]>;
    posts: RouteInfo<{}, Selectable<Post>[]>;
    post: RouteInfo<{ postId: number }, Returns.PostDetails | undefined>;
    content: RouteInfo<{ contentId: number }, GetContent | undefined>;
    chats: RouteInfo<void, Returns.Chats>;
    chat: RouteInfo<{ userId: number }, Returns.ChatDetails>;
    conversation: RouteInfo<
      { conversationId: number },
      Returns.ConversationDetails
    >;
  };
  delete: {
    session: RouteInfo;
    friend: RouteInfo<{ userId: number }>;
    userPost: RouteInfo<{ postId: number; userId: number }>;
  };
  put: {
    user: RouteInfo<{ user: Partial<Omit<User, "id" | "name">> }>;
    friend: RouteInfo<{ userId: number }>;
    group: RouteInfo<{ name: string }>;
    groupMember: RouteInfo<{
      groupId: number;
      userId: number;
      role: "owner" | "member";
    }>;
    groupConversation: RouteInfo<{ groupId: number; conversationId: number }>;
    conversation: RouteInfo<{}>;
    message: RouteInfo<
      { conversationId: number; text: string },
      { id: number; created: Date }
    >;
    post: RouteInfo<PutPost, { id: number }>;
    content: RouteInfo<{}, { id: number }>;
    postContent: RouteInfo<{ postId: number; contentId: number }>;
    userPost: RouteInfo<{
      userId: number;
      postId: number;
      relation: UserPostRelation;
    }>;
  };
}
