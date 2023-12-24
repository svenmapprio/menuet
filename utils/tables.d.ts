import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, string | number | bigint, string | number | bigint>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type UserPostRelation = "consumer" | "creator" | "owner";

export interface Account {
  sub: string;
  type: string;
  email: string | null;
  userId: number;
}

export interface Content {
  id: Generated<number>;
  userId: number;
  name: Generated<string>;
}

export interface Conversation {
  id: Generated<number>;
  postId: number;
  created: Generated<Timestamp>;
  latestMessageId: number | null;
}

export interface ConversationUser {
  conversationId: number;
  userId: number;
}

export interface Friend {
  userId: number;
  friendId: number;
}

export interface LatestFriendConversation {
  userId: number;
  friendId: number;
  conversationId: number | null;
}

export interface Message {
  id: Generated<number>;
  conversationId: number;
  text: Generated<string>;
  created: Generated<Timestamp>;
  userId: number;
}

export interface Post {
  id: Generated<number>;
  name: string;
  description: string | null;
  created: Generated<Timestamp>;
}

export interface PostContent {
  postId: number;
  contentId: number;
}

export interface SocketIoAttachments {
  id: Generated<Int8>;
  createdAt: Generated<Timestamp | null>;
  payload: Buffer | null;
}

export interface User {
  id: Generated<number>;
  handle: string;
  firstName: string;
  lastName: string | null;
  name: Generated<string | null>;
  picture: string | null;
}

export interface UserPost {
  userId: number;
  postId: number;
  relation: UserPostRelation;
  created: Generated<Timestamp>;
}

export interface DB {
  account: Account;
  content: Content;
  conversation: Conversation;
  conversationUser: ConversationUser;
  friend: Friend;
  latestFriendConversation: LatestFriendConversation;
  message: Message;
  post: Post;
  postContent: PostContent;
  socketIoAttachments: SocketIoAttachments;
  user: User;
  userPost: UserPost;
}
