import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, string | number | bigint, string | number | bigint>;

export type ParagraphType = "place_description";

export type PlaceInternalStatus = "done" | "generating" | "generation_failed" | "should_regenerate";

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

export interface OauthSession {
  refreshToken: string;
  accessToken: string;
  created: Generated<Timestamp>;
  id: Generated<string>;
  provider: string;
}

export interface Paragraph {
  id: Generated<number>;
  text: string;
  type: ParagraphType;
  ownerId: number;
}

export interface ParagraphUrl {
  id: Generated<number>;
  url: string;
  paragraphId: number;
}

export interface Place {
  id: Generated<number>;
  googlePlaceId: string | null;
  name: string;
  street: string | null;
  city: string | null;
  country: string | null;
  instagram: string | null;
  email: string | null;
  internalStatus: Generated<PlaceInternalStatus>;
  created: Generated<Timestamp>;
}

export interface Post {
  id: Generated<number>;
  description: string | null;
  created: Generated<Timestamp>;
  placeId: number;
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
  picture: string | null;
  name: Generated<string | null>;
}

export interface UserPlace {
  userId: number;
  placeId: number;
}

export interface UserPost {
  userId: number;
  postId: number;
  relation: UserPostRelation;
  created: Generated<Timestamp>;
}

export interface UserSocket {
  userId: number;
  socketId: string;
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
  oauthSession: OauthSession;
  paragraph: Paragraph;
  paragraphUrl: ParagraphUrl;
  place: Place;
  post: Post;
  postContent: PostContent;
  socketIoAttachments: SocketIoAttachments;
  user: User;
  userPlace: UserPlace;
  userPost: UserPost;
  userSocket: UserSocket;
}
