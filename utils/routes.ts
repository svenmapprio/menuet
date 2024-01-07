import { Insertable, Selectable } from "kysely";
import {
  Content,
  Conversation,
  Message,
  Paragraph,
  ParagraphUrl,
  Place,
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

export namespace BingTypes {
  export type Restaurant = {
    _type: "Restaurant";
    id: string;
    entityPresentationInfo: {
      entityScenario: string;
    };
  };

  export type WebPage = {
    id: string;
    name: string;
    url: string;
    isFamilyFriendly: boolean;
    displayUrl: string;
    snippet: string;
    deepLinks: Array<{
      name: string;
      url: string;
    }>;
    dateLastCrawled: string;
    language: string;
    isNavigational: boolean;
  };

  export type SearchResponse = {
    _type: "SearchResponse";
    queryContext: {
      originalQuery: string;
    };
    webPages: {
      webSearchUrl: string;
      totalEstimatedMatches: number;
      value: Array<WebPage>;
    };
    images: {
      id: string;
      readLink: string;
      webSearchUrl: string;
      isFamilyFriendly: boolean;
      value: Array<object>;
    };
    places: {
      value: Array<object>;
    };
    rankingResponse: {
      mainline: { items: Array<any> };
      sidebar: { items: Array<any> };
    };
  };
}

export namespace OpenaiTypes {
  export type PlaceDescriptionParagraph = {
    text: string;
    sources: string[];
  };

  export type PlaceDescription = [PlaceDescriptionParagraph];

  export type Place = {
    name: string;
    street: string;
    city: string;
    country: string;
    instagramHandle: string | undefined;
    businessEmail: string | undefined;
    description: PlaceDescription;
  };
}

export namespace GoogleTypes {
  export type AutocompleteResponse = {
    predictions: AutocompletePlace[];
  };

  export type AutocompletePlace = {
    description: string;
    place_id: string;
    structured_formatting: {
      main_text: string;
      secondary_text: string;
    };
    terms: { offset: number; value: string }[];
    types: string[];
  };
}

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

  export type PlaceDetails = {
    place: Selectable<Place>,
    paragraphs: {
      paragraph: Selectable<Paragraph>,
      sources: Selectable<ParagraphUrl>[]
    }[]
  };

  export type PlacePredictions =
    GoogleTypes.AutocompleteResponse["predictions"];
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
    place: RouteInfo<{ placeId: number }, Returns.PlaceDetails | undefined>;
    places: RouteInfo<{ name: string }, Returns.PlacePredictions>;
  };
  delete: {
    session: RouteInfo;
    friend: RouteInfo<{ userId: number }>;
    userPost: RouteInfo<{ postId: number; userId: number }>;
  };
  put: {
    user: RouteInfo<{
      user: Partial<Omit<User, "id" | "name">>;
      defaultHandle: boolean;
    }>;
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
    place: RouteInfo<
      {
        googlePlaceId: string;
        description: string;
        name: string;
      },
      { id: number } | undefined
    >;
    content: RouteInfo<{}, { id: number }>;
    postContent: RouteInfo<{ postId: number; contentId: number }>;
    userPost: RouteInfo<{
      userId: number;
      postId: number;
      relation: UserPostRelation;
    }>;
  };
}
