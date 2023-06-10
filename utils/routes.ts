import { Insertable, Selectable } from "kysely"
import { Content, Conversation, Message, Post, User, UserPostRelation } from "./tables"
import { RouteInfo, Routes, Session, UsersListItem, UsersFilter, ShareUsersListItem } from "./types"

export type GetContent = Pick<Selectable<Content>, 'name'|'id'>;

export type GetPost = {
    post: Selectable<Post>,
    content: GetContent[],
    relations: UserPostRelation[]
}

export type PutPost = {
    post: Insertable<Post>,
    content: GetContent[]
}

export type GetMessage = {
    message: Selectable<Message>,
    user: Pick<Selectable<User>, 'id' | 'handle'>,
}

export type GetConversation = {
    post: GetPost,
    conversation: Selectable<Conversation>,
    messages: GetMessage[]
}

export type GetChat = {
    user: Pick<Selectable<User>, 'id'|'handle'>,
    conversations: {
        conversation: Pick<Selectable<Conversation>, 'id'>
        post: Selectable<Post>,
        content: {name: string}[],
    }[]
}

export interface PublicRoutes extends Routes {
    get: {
        session: RouteInfo<{}, Session | null>,
        users: RouteInfo<{filter?: UsersFilter}, UsersListItem[]>,
        shareUsers: RouteInfo<{postId: number}, ShareUsersListItem[]>
        posts: RouteInfo<{}, Selectable<Post>[]>,
        post: RouteInfo<{postId: number}, GetPost | undefined>,
        content: RouteInfo<{contentId: number}, GetContent | undefined>,
        chats: RouteInfo<void, Pick<Selectable<User>, 'id' | 'handle'>[]>,
        chat: RouteInfo<{userId: number}, GetChat>,
        conversation: RouteInfo<{conversationId: number}, GetConversation>
    },
    delete:{
        session: RouteInfo,
        friend: RouteInfo<{userId: number}>,
        userPost: RouteInfo<{postId: number, userId: number}>,
    },
    put:{
        user: RouteInfo<{user: Partial<Omit<User, 'id'|'name'>>}>,
        friend: RouteInfo<{userId: number}>,
        group: RouteInfo<{name: string}>,
        groupMember: RouteInfo<{groupId: number, userId: number, role: 'owner'|'member'}>,
        groupConversation: RouteInfo<{groupId: number, conversationId: number}>,
        conversation: RouteInfo<{}>,
        message: RouteInfo<{conversationId: number, text: string}>,
        post: RouteInfo<PutPost, {id: number}>,
        content: RouteInfo<{}, {id: number}>,
        postContent: RouteInfo<{postId: number, contentId: number}>
        userPost: RouteInfo<{userId: number, postId: number, relation: UserPostRelation}>
    }
}