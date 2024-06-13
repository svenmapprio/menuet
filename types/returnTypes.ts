import { Selectable, Insertable } from "kysely";
import {
  Account,
  User,
  Content,
  Post,
  Message,
  Conversation,
  UserPostRelation,
  Place,
  Paragraph,
  ParagraphUrl,
} from "./tables";

export type Session = {
  account: Pick<Selectable<Account>, "email" | "type" | "sub">;
  user: Pick<
    Selectable<User>,
    "name" | "handle" | "id" | "firstName" | "lastName"
  >;
};

export type ShareUsersListItem = Pick<Selectable<User>, "handle" | "id"> & {
  shared: boolean;
};
export type UsersFilter = "all" | "friend";

export type UsersListItem = Pick<Selectable<User>, "handle" | "id"> & {
  self: boolean;
  other: boolean;
};

export type GetContent = Pick<Selectable<Content>, "name" | "id">;

export type PutPost = {
  post: Insertable<Post>;
  content: GetContent[];
  users?: number[];
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

  export type PlaceDescription = PlaceDescriptionParagraph[];

  export type Place = {
    name: string;
    street: string;
    city: string;
    country: string;
    instagramHandle: string | undefined;
    businessEmail: string | undefined;
    description: PlaceDescription;
    tags: string[];
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
  export type UserItem = Pick<Selectable<User>, "id" | "handle">;

  export type ChatDetails = {
    user: Pick<Selectable<User>, "id" | "handle">;
    conversations: {
      conversation: Pick<Selectable<Conversation>, "id">;
      messagesCount: number;
      post: Selectable<Post> & {
        relation: UserPostRelation;
        place: Pick<Selectable<Place>, "id" | "name">;
      };
      content: { name: string }[];
    }[];
  };

  export type Chats = {
    user: Pick<Selectable<User>, "id" | "handle">;
    conversation: {
      post: Selectable<Post> & {
        place: Pick<Selectable<Place>, "id" | "name">;
      };
      message?: Pick<Selectable<Message>, "id" | "text" | "created" | "userId">;
    };
  }[];

  export type ConversationDetails = {
    conversation: Omit<Selectable<Conversation>, "latestMessageId">;
    messages: GetMessage[];
  };

  export type PostDetails = {
    post: Selectable<Post>;
    place: Selectable<Place>;
    content: GetContent[];
    relations: { relation: UserPostRelation }[];

    conversations: {
      id: number;
      user: Pick<Selectable<User>, "id" | "handle">;
    }[];
  };

  export type PostListItem = {
    post: Selectable<Post>;
    place: Selectable<Place>;
    content: GetContent[];
  };

  export type PlaceDetails = {
    place: Selectable<Place>;
    paragraphs: {
      paragraph: Selectable<Paragraph>;
      sources: Selectable<ParagraphUrl>[];
    }[];
  };

  export type PlacePredictions =
    GoogleTypes.AutocompleteResponse["predictions"];
}
