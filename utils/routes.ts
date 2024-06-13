import { RouteInfo, Routes, UserRouteInfo } from "@/types/appRoutes";
import {
  Session,
  Returns,
  GetContent,
  UsersFilter,
  ShareUsersListItem,
  PutPost,
  UsersListItem,
} from "@/types/returnTypes";
import { User, UserPostRelation } from "@/types/tables";

export interface PublicRoutes extends Routes {
  get: {
    beep: RouteInfo<{ socketId: string }>;
    session: RouteInfo<{}, Session | null>;
    users: RouteInfo<{ term?: string; filter?: UsersFilter }, UsersListItem[]>;
    shareUsers: UserRouteInfo<{ postId: number }, ShareUsersListItem[]>;
    posts: UserRouteInfo<void, Returns.PostListItem[]>;
    post: UserRouteInfo<{ postId: number }, Returns.PostDetails | undefined>;
    content: UserRouteInfo<{ contentId: number }, GetContent | undefined>;
    chats: UserRouteInfo<void, Returns.Chats>;
    chat: UserRouteInfo<{ userId: number }, Returns.ChatDetails>;
    conversation: UserRouteInfo<
      { conversationId: number },
      Returns.ConversationDetails
    >;
    place: RouteInfo<{ placeId: number }, Returns.PlaceDetails | undefined>;
    places: RouteInfo<{ name: string }, Returns.PlacePredictions>;
  };
  delete: {
    session: UserRouteInfo;
    friend: UserRouteInfo<{ userId: number }>;
    userPost: UserRouteInfo<{ postId: number; userId: number }>;
  };
  put: {
    user: UserRouteInfo<{
      user: Partial<Omit<User, "id" | "name">>;
      defaultHandle: boolean;
    }>;
    friend: UserRouteInfo<{ userId: number }>;
    group: UserRouteInfo<{ name: string }>;
    groupMember: UserRouteInfo<{
      groupId: number;
      userId: number;
      role: "owner" | "member";
    }>;
    groupConversation: UserRouteInfo<{
      groupId: number;
      conversationId: number;
    }>;
    conversation: UserRouteInfo<{}>;
    message: UserRouteInfo<
      { conversationId: number; text: string },
      { id: number; created: Date }
    >;
    post: UserRouteInfo<PutPost, { id: number }>;
    place: UserRouteInfo<
      {
        googlePlaceId: string;
        description: string;
        name: string;
      },
      { id: number } | undefined
    >;
    content: UserRouteInfo<{}, { id: number }>;
    postContent: UserRouteInfo<{ postId: number; contentId: number }>;
    userPost: UserRouteInfo<{
      userId: number;
      postId: number;
      relation: UserPostRelation;
    }>;
  };
}
