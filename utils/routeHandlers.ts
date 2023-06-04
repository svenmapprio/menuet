import {Selectable, sql} from 'kysely';
import { jsonBuildObject, jsonObjectFrom } from 'kysely/helpers/postgres';
import { GetConversation, GetPost, PublicRoutes, PutPost, } from "./routes";
import { RouteHandlers } from "./types";
import { dbCommon, pgEmitter } from './db';
import { Post } from './tables';

export interface PublicRouteHandlers extends RouteHandlers<PublicRoutes>{}

export const routeHandlers: PublicRouteHandlers = {
    delete: {
        session: async ({req, headers}) => {
            headers['Set-Cookie'] = `refresh_token=unset;Secure; HttpOnly; SameSite=None; Path=/; Max-Age=0;`;
        },
        friend: async ({trx, session, userId}) => {
            const sourceUserId = session.user.id;
            const targetUserId = userId;

            if(sourceUserId !== targetUserId){
                await trx.deleteFrom('friend')
                    .where('friend.friendId', '=', targetUserId)
                    .where('friend.userId', '=', sourceUserId)
                    .execute();
            }

            pgEmitter.to(targetUserId.toString()).to(sourceUserId.toString()).emit('mutation', 'users');
        },
        userPost: async ({trx, postId, userId, session}) => {
            await trx.deleteFrom('userPost')
            .where('postId', '=', postId)
            .where('userId', '=', userId)
            .where('relation', '=', 'consumer')
            .execute();

            pgEmitter.to(session.user.id.toString()).emit('mutation', ['shareUsers', postId]);
            pgEmitter.to(userId.toString()).to(session.user.id.toString()).emit('mutation', 'chats');
            pgEmitter.to(session.user.id.toString()).emit('mutation', ['chat', userId]);
            pgEmitter.to(userId.toString()).emit('mutation', ['chat', session.user.id]);
        },
    },
    get: {
        session: async ({trx, session}) => {
            return session ?? undefined;
        },
        posts: async ({trx, session}) => (
            await trx.selectFrom("post")
            .select(['created', 'description', 'id', 'name'])
            .innerJoin("userPost", "userPost.postId", "post.id")
            .where('userPost.relation', '=', 'owner')
            .where('userPost.userId', '=', session.user.id)
            .execute()
        ),
        users: async ({trx, session, filter = 'all'}) => {
            return dbCommon.getUsersWithStatus(trx, session?.user.id, filter);
        },
        shareUsers: async ({trx, session, postId}) => {
            return dbCommon.getShareUsers(trx, session.user.id, postId);
        },
        post: async ({trx, postId, session}) => {
            return dbCommon.getPost(trx, postId, session.user.id);
        },
        content: async ({trx, contentId, session}) => {
            return await trx.selectFrom('content').select(['content.name', 'content.id']).where('content.id', '=', contentId).executeTakeFirst();
        },
        chat: async ({trx, userId, session}) => {
            const user = await trx.selectFrom('user')
                .select(['id', 'handle'])
                .where('id', '=', userId).executeTakeFirstOrThrow();

            const conversations = await trx.selectFrom('conversation')
            .innerJoin('post', 'post.id', 'conversation.postId')
            .innerJoin('postContent', 'postContent.postId', 'post.id')
            .innerJoin('content', 'content.id', 'postContent.contentId')
            .select(sq => [
                jsonBuildObject({
                    id: sq.ref('conversation.id')
                }).as('conversation'),
                jsonBuildObject({
                    id: sq.ref('post.id'),
                    name: sq.ref('post.name'),
                    created: sq.ref('post.created'),
                    description: sq.ref('post.description'),
                }).as('post'),
                sql<{name: string}[]>`array_agg(content.name)`.as('content')
            ])
            .innerJoin('conversationUser as cua', join => (
                join
                    .on('cua.userId', '=', session.user.id)
                    .onRef('cua.conversationId', '=', 'conversation.id')
            ))
            .innerJoin('conversationUser as cub', join => (
                join
                    .on('cub.userId', '=', userId)
                    .onRef('cub.conversationId', '=', 'conversation.id')
            ))
            .groupBy(['post.id', 'conversation.id'])
            .execute();

            return {user, conversations};
        },
        chats: async ({trx, session}) => {
            return await trx.selectFrom('conversationUser as cua')
                .innerJoin('conversationUser as cub', 'cub.conversationId', 'cua.conversationId')
                .innerJoin('user as other', 'other.id', 'cub.userId')
                .select(['other.id', 'other.handle'])
                .where('cua.userId', '=', session.user.id)
                .where('other.id', '<>', session.user.id)
                .distinct()
                .execute();
        },
        conversation: async ({conversationId, trx, session}) => {
            const conversation = await trx.selectFrom('conversation')
                .select(['conversation.id', 'conversation.postId'])
                .where('conversation.id', '=', conversationId)
                .executeTakeFirstOrThrow();

            const post = await dbCommon.getPost(trx, conversation.postId, session.user.id);

            const messages = await trx.selectFrom('message as outer')
                .select(sq => [
                    jsonObjectFrom(sq
                        .selectFrom('message as inner')
                        .select(['inner.conversationId', 'inner.created', 'inner.id', 'inner.text', 'inner.userId'])
                        .whereRef('inner.id', '=', 'outer.id')
                    ).as('message'),
                    jsonObjectFrom(sq
                        .selectFrom('user')
                        .select(['user.id', 'user.handle'])
                        .whereRef('user.id', '=', 'outer.userId')
                    ).as('user')
                ])
                .where('outer.conversationId', '=', conversationId)
                .execute();

            return {conversation,messages,post};
        }
    },
    put: {
        post: async ({trx, session, post: {id, name, description}, content}) => {
            const insert = await trx.insertInto("post")
                .onConflict(oc => oc.column("id").doUpdateSet({name, description}))
                .values({id, name, description})
                .returning("id")
                .executeTakeFirstOrThrow();

            await trx.insertInto("userPost")
            .values({postId: insert.id, userId: session.user.id, relation: 'owner'})
            .onConflict(oc => oc.columns(["postId", "userId", "relation"]).doNothing())
            .execute();

            await trx.deleteFrom('postContent')
            .where('postContent.postId', '=', insert.id)
            .execute();

            if(content.length){
                await trx.insertInto('postContent')
                .values(content.map(c => ({contentId: c.id, postId: insert.id})))
                .onConflict(oc => oc.columns(['contentId', 'postId']).doNothing())
                .execute();
            }

            pgEmitter.to(session.user.id.toString()).emit("mutation", 'posts');

            return insert;
        },
        postContent: async ({trx, postId, contentId, session}) => {
            await trx.insertInto('postContent')
            .values({contentId, postId})
            .onConflict(oc => oc.columns(['contentId', 'postId']).doNothing())
            .execute();

            pgEmitter.to(session.user.id.toString()).emit('mutation', 'post');
        },
        content: async ({trx, session}) => {
            const insert = await trx.insertInto('content')
            .values({ userId:session.user.id })
            .returning('content.id')
            .executeTakeFirstOrThrow();

            return insert;
        },
        user: async ({session, trx, user}) => {
            await trx.updateTable("user").set({...user}).where("id", "=", session.user.id).execute();

            pgEmitter.to(session.user.id.toString()).emit('mutation', 'session');
        },
        conversation: async ({}) => {},
        friend: async ({trx, session, userId}) => {
            const sourceUserId = session.user.id;
            const targetUserId = userId;

            if(targetUserId !== session.user.id){
                await trx.insertInto('friend').values({friendId: targetUserId, userId: sourceUserId})
                .onConflict(oc => oc.columns(['friendId', 'userId']).doNothing())
                .execute();
            }

            pgEmitter.to(targetUserId.toString()).to(sourceUserId.toString()).emit('mutation', 'users');
        },
        group: async ({}) => {},
        groupConversation: async ({}) => {},
        groupMember: async ({}) => {},
        message: async ({trx, conversationId, session, text}) => {
            await trx.insertInto('message').values({text, conversationId, userId: session.user.id}).execute();

            const {userId} = await trx.selectFrom('conversationUser')
                .select('conversationUser.userId')
                .where('conversationUser.conversationId', '=', conversationId)
                .where('conversationUser.userId', '<>', session.user.id)
                .executeTakeFirstOrThrow();

            pgEmitter.to(userId.toString()).to(session.user.id.toString()).emit('mutation', ['conversation', conversationId]);
        },
        userPost: async ({trx, session, postId, userId, relation}) => {
            await trx.insertInto('userPost')
                .values({userId, postId, relation})
                .onConflict(oc => oc.columns(['postId', 'userId', 'relation']).doNothing())
                .execute();

            const existingConversation = await trx.selectFrom('conversation')
                .innerJoin('conversationUser as cua', join => (
                    join
                        .onRef('cua.conversationId', '=', 'conversation.id')
                        .on('cua.userId', '=', session.user.id)
                ))
                .innerJoin('conversationUser as cub', join => (
                    join
                        .onRef('cub.conversationId', '=', 'conversation.id')
                        .on('cub.userId', '=', userId)
                ))
                .select('conversation.id')
                .where('conversation.postId', '=', postId).executeTakeFirst();

            if(!existingConversation){
                const newConversation = await trx.insertInto('conversation')
                .values({postId})
                .returning('id')
                .executeTakeFirstOrThrow();

                await trx.insertInto('conversationUser').values([
                    {conversationId: newConversation.id, userId: session.user.id}, 
                    {conversationId: newConversation.id, userId},
                ])
                .onConflict(oc => oc.columns(['conversationId', 'userId']).doNothing())
                .execute();
            }

            pgEmitter.to(session.user.id.toString()).emit('mutation', ['shareUsers', postId]);
            pgEmitter.to(userId.toString()).to(session.user.id.toString()).emit('mutation', 'chats');
            pgEmitter.to(session.user.id.toString()).emit('mutation', ['chat', userId]);
            pgEmitter.to(userId.toString()).emit('mutation', ['chat', session.user.id]);
        },
    }
}
