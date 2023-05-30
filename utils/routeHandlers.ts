import {sql} from 'kysely';
import { GetPost, PublicRoutes, PutPost, } from "./routes";
import { RouteHandlers } from "./types";
import { pgEmitter } from './db';

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
        }
    },
    get: {
        session: async ({trx, session}) => {
            return session ?? undefined;
        },
        posts: async ({trx, session}) => {
            return await trx.selectFrom("post")
                .select(['created', 'description', 'id', 'name'])
                .innerJoin("userPost", "userPost.postId", "post.id")
                .where('userPost.relation', '=', 'owner')
                .where('userPost.userId', '=', session.user.id)
                .execute();
        },
        users: async ({trx, session, filter = ''}) => {
            const q = trx.selectFrom(['user as u'])
            .leftJoin('user as uu', join => join.on('uu.id', '=', session?.user.id ?? null))
            .leftJoin('friend as self', 'self.userId', 'uu.id')
            .leftJoin('friend as other', 'other.friendId', 'uu.id')
            .select(['u.handle', 'u.id'])
            .select(sql<boolean>`case 
                when self.user_id is not null then true else false end
            `.as('self'))
            .select(sql<boolean>`case 
                when other.user_id is not null then true else false end
            `.as('other'))
            .where('u.handle', 'ilike', `%${filter}%`)
            .where('u.id', '<>', session!.user.id);

            const users = await q.execute();

            return users;
        },
        post: async ({trx, postId, session}) => {
            const post = await trx
                .selectFrom('post')
                .select(['post.id', 'post.name', 'post.description', 'post.created'])
                .where('id', '=', postId)
                .executeTakeFirstOrThrow();

            const relations = await trx.selectFrom('userPost')
                .select('relation')
                .where('userId', '=', session.user.id)
                .where('postId', '=', postId)
                .execute();

            const content = await trx.selectFrom('postContent')
                .innerJoin('content', 'content.id', 'postContent.contentId')
                .select(['content.id', 'content.name'])
                .where('postContent.postId', '=', postId)
                .execute();

            return {post, relations: relations?.map(r => r.relation), content};
        },
        content: async ({trx, contentId, session}) => {
            return await trx.selectFrom('content').select(['content.name', 'content.id']).where('content.id', '=', contentId).executeTakeFirst();
        },
    },
    put: {
        post: async ({trx, session, post: {id, name, description}}) => {
            const insert = await trx.insertInto("post")
                .onConflict(oc => oc.column("id").doUpdateSet({name, description}))
                .values({id, name, description})
                .returning("id")
                .executeTakeFirstOrThrow();

            await trx.insertInto("userPost")
            .values({postId: insert.id, userId: session.user.id, relation: 'owner'})
            .onConflict(oc => oc.columns(["postId", "userId", "relation"]).doNothing())
            .execute();

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
        message: async ({}) => {},
    }
}

// export interface UserRouteHandlers extends RouteHandlers<UserRoutes, {trx: Transaction<DB>, session: Session}>{}

// export const userRouteHandlers: UserRouteHandlers = {
//     delete: {
//         session: async ({req, headers}) => {
//             headers['Set-Cookie'] = `refresh_token=unset;Secure; HttpOnly; SameSite=None; Path=/; Max-Age=0;`;
//         },
//         friend: async ({trx, session, userId}) => {
//             const sourceUserId = session.user.id;
//             const targetUserId = userId;

//             if(sourceUserId !== targetUserId){
//                 await trx.deleteFrom('friend')
//                     .where('friend.friendId', '=', targetUserId)
//                     .where('friend.userId', '=', sourceUserId)
//                     .execute();
//             }

//             pgEmitter.to(targetUserId.toString()).to(sourceUserId.toString()).emit('mutation', 'users');
//         }
//     },
//     get: {
//         session: async ({trx, session}) => {
//             return session ?? undefined;
//         },
//         posts: async ({trx, session}) => {
//             return await trx.selectFrom("post")
//                 .select(['created', 'description', 'id', 'name'])
//                 .innerJoin("userPost", "userPost.postId", "post.id")
//                 .where('userPost.relation', '=', 'owner')
//                 .execute();
//         },
//         users: async ({trx, session, filter = ''}) => {
//             const q = trx.selectFrom(['user as u'])
//             .leftJoin('user as uu', join => join.on('uu.id', '=', session?.user.id ?? null))
//             .leftJoin('friend as self', 'self.userId', 'uu.id')
//             .leftJoin('friend as other', 'other.friendId', 'uu.id')
//             .select(['u.handle', 'u.id'])
//             .select(sql<boolean>`case 
//                 when self.user_id is not null then true else false end
//             `.as('self'))
//             .select(sql<boolean>`case 
//                 when other.user_id is not null then true else false end
//             `.as('other'))
//             .where('u.handle', 'ilike', `%${filter}%`)
//             .where('u.id', '<>', session!.user.id);

//             const users = await q.execute();

//             return users;
//         }
//     },
//     put: {
//         post: async ({trx, session, post: {id, name, description}}) => {
//             const insert = await trx.insertInto("post")
//                 .onConflict(oc => oc.column("id").doUpdateSet({name, description}))
//                 .values({id, name, description})
//                 .returning("id")
//                 .executeTakeFirstOrThrow();

//             await trx.insertInto("userPost")
//             .values({postId: insert.id, userId: session.user.id, relation: 'owner'})
//             .onConflict(oc => oc.columns(["postId", "userId", "relation"]).doNothing())
//             .execute();

//             pgEmitter.to(session.user.id.toString()).emit("mutation", 'posts');

//             return insert;
//         },
//         user: async ({session, trx, user}) => {
//             await trx.updateTable("user").set({...user}).where("id", "=", session.user.id).execute();

//             pgEmitter.to(session.user.id.toString()).emit('mutation', 'session');
//         },
//         conversation: async ({}) => {},
//         friend: async ({trx, session, userId}) => {
//             const sourceUserId = session.user.id;
//             const targetUserId = userId;

//             if(targetUserId !== session.user.id){
//                 await trx.insertInto('friend').values({friendId: targetUserId, userId: sourceUserId})
//                 .onConflict(oc => oc.columns(['friendId', 'userId']).doNothing())
//                 .execute();
//             }

//             pgEmitter.to(targetUserId.toString()).to(sourceUserId.toString()).emit('mutation', 'users');
//         },
//         group: async ({}) => {},
//         groupConversation: async ({}) => {},
//         groupMember: async ({}) => {},
//         message: async ({}) => {},
//     }
// }