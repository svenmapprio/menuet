import { Kysely, sql, Transaction } from "kysely";
import { ApiError, ErrorCode } from "./db";
import { PublicRoutes } from "./routes";
import { DB } from "./tables";
import { RouteGuards, Session } from "./types";

export interface PublicRouteGuards extends RouteGuards<PublicRoutes>{};

const guardHelpers = {
    content:{
        isOwner: async (trx: Transaction<DB>, contentId: number, userId: number) => (
            !!await trx.selectFrom('content')
            .where('content.id', '=', contentId)
            .where('content.userId', '=', userId)
            .executeTakeFirst()
        ),
        isShared: async (trx: Transaction<DB>, contentId: number, userId: number) => (
            !!await trx.selectFrom("userPost")
            .innerJoin('postContent', 'postId', 'userPost.postId')
            .where('userId', '=', userId)
            .where('postContent.contentId', '=', contentId)
            .where(({or, cmpr}) => or([
                cmpr('relation', '=', 'consumer'),
                cmpr('relation', '=', 'creator'),
            ]))
            .executeTakeFirst()
        ),
    },
    post: {
        isOwner: async (trx: Transaction<DB>, postId: number, session: Session) => (
            !!await trx.selectFrom("userPost")
            .where("postId", '=', postId)
            .where('userId', '=', session.user.id)
            .where('relation', '=', 'owner')
            .executeTakeFirst()
        ),
        isShared: async (trx: Transaction<DB>, postId: number, session: Session) => (
            !!await trx.selectFrom("userPost")
            .where("postId", '=', postId)
            .where('userId', '=', session.user.id)
            .where(({or, cmpr}) => or([
                cmpr('relation', '=', 'consumer'),
                cmpr('relation', '=', 'creator'),
            ]))
            .executeTakeFirst()
        ),
        isPublic: async () => {
            return false;
        },
    },
    conversation: {
        isParticipant: async (trx: Transaction<DB>, conversationId: number, session: Session) => (
            !!await trx.selectFrom('conversation').innerJoin('conversationUser', join => (
                join
                    .on('conversationUser.userId', '=', session.user.id)
                    .onRef('conversationUser.conversationId', '=', 'conversation.id')
            )).executeTakeFirst()
        )
    },
    user: {
        isFriend: async (trx: Transaction<DB>, userId: number, session: Session) => {
            const findRequest = async (a: number, b: number) => trx.selectFrom('friend').select('userId')
                .where('friend.userId', '=', a)
                .where('friend.friendId', '=', b)
                .executeTakeFirst();

            return await Promise.all([
                findRequest(userId, session.user.id),
                findRequest(session.user.id, userId),
            ]).then(res => res.every(Boolean));
        }
    }
}

const guards: PublicRouteGuards = {
    delete: {
        userPost: async ({trx, postId, userId, session}) => {
            if(
                !await guardHelpers.post.isOwner(trx, postId, session)
            )
                throw new ApiError(ErrorCode.ResourcePermissions);
        }
    },
    get: {
        post: async ({session, postId, trx}) => {
            if(
                !await guardHelpers.post.isOwner(trx, postId, session) && 
                !await guardHelpers.post.isShared(trx, postId, session)
            )
                throw new ApiError(ErrorCode.ResourcePermissions);
        },
        content: async ({session, contentId, trx}) => {
            if(
                !await guardHelpers.content.isShared(trx, contentId, session.user.id) && 
                !await guardHelpers.content.isOwner(trx, contentId, session.user.id)
            )
                throw new ApiError(ErrorCode.ResourcePermissions);
        },
        chat: async ({trx, userId, session}) => {
            if(!await guardHelpers.user.isFriend(trx, userId, session))
                throw new ApiError(ErrorCode.ResourcePermissions);
        },
        conversation: async ({conversationId, session, trx}) => {
            if(!await guardHelpers.conversation.isParticipant(trx, conversationId, session))
                throw new ApiError(ErrorCode.ResourcePermissions);
        }
    },
    put: {
        postContent: async ({trx, postId, contentId, session}) => {
            if(
                !await guardHelpers.post.isOwner(trx, postId, session) || 
                !await guardHelpers.content.isOwner(trx, contentId, session.user.id)
            )
                throw new ApiError(ErrorCode.ResourcePermissions);
        },
        userPost: async ({trx, postId, userId, session}) => {
            if(
                !await guardHelpers.post.isOwner(trx, postId, session) ||
                !await guardHelpers.user.isFriend(trx, userId, session)
            )
                throw new ApiError(ErrorCode.ResourcePermissions);
        },
        message: async ({trx, session, conversationId}) => {
            if(!await guardHelpers.conversation.isParticipant(trx, conversationId, session))
                throw new ApiError(ErrorCode.ResourcePermissions);
        }
    }
}

export default guards;