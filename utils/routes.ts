import { Insertable, Selectable } from "kysely"
import { Content, Post, User, UserPostRelation } from "./tables"
import { RouteInfo, Routes, Session, UsersListItem } from "./types"

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

export interface PublicRoutes extends Routes {
    get: {
        session: RouteInfo<{}, Session | null>,
        users: RouteInfo<{filter?: string}, UsersListItem[]>,
        posts: RouteInfo<{}, Selectable<Post>[]>,
        post: RouteInfo<{postId: number}, GetPost | undefined>,
        content: RouteInfo<{contentId: number}, GetContent | undefined>,
    },
    delete:{
        session: RouteInfo,
        friend: RouteInfo<{userId: number}>
    },
    put:{
        user: RouteInfo<{user: Partial<Omit<User, 'id'|'name'>>}>,
        friend: RouteInfo<{userId: number}>,
        group: RouteInfo<{name: string}>,
        groupMember: RouteInfo<{groupId: number, userId: number, role: 'owner'|'member'}>,
        groupConversation: RouteInfo<{groupId: number, conversationId: number}>,
        conversation: RouteInfo<{}>,
        message: RouteInfo<{conversationId: number}>,
        post: RouteInfo<PutPost, {id: number}>,
        content: RouteInfo<{}, {id: number}>,
        postContent: RouteInfo<{postId: number, contentId: number}>
    }
}

// export interface UserRoutes extends Routes {
//     get: {
        
//     },
//     put: {
       
//     }
//     delete: {
//         session: RouteInfo,
//         friend: RouteInfo<{userId: number}>
//     }
// }