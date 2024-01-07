import { Selectable, sql } from "kysely";
import { jsonBuildObject, jsonObjectFrom } from "kysely/helpers/postgres";
import {
  BingTypes,
  GoogleTypes,
  OpenaiTypes,
  PublicRoutes,
  PutPost,
} from "./routes";
import { RouteHandlers } from "./types";
import { dbCommon, pgEmitter } from "./db";
import { Content, Post } from "./tables";
import axios from "axios";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { load } from "cheerio";
import puppeteer from "puppeteer";

export interface PublicRouteHandlers extends RouteHandlers<PublicRoutes> {}

export const routeHandlers: PublicRouteHandlers = {
  delete: {
    session: async ({ req, headers }) => {
      headers[
        "Set-Cookie"
      ] = `refresh_token=unset;Secure; HttpOnly; SameSite=None; Path=/; Max-Age=0;`;
    },
    friend: async ({ trx, session, userId }) => {
      const sourceUserId = session.user.id;
      const targetUserId = userId;

      if (sourceUserId !== targetUserId) {
        await trx
          .deleteFrom("friend")
          .where("friend.friendId", "=", targetUserId)
          .where("friend.userId", "=", sourceUserId)
          .execute();
      }

      pgEmitter
        .to(targetUserId.toString())
        .to(sourceUserId.toString())
        .emit("mutation", "users");
    },
    userPost: async ({ trx, postId, userId, session }) => {
      await trx
        .deleteFrom("userPost")
        .where("postId", "=", postId)
        .where("userId", "=", userId)
        .where("relation", "=", "consumer")
        .execute();

      pgEmitter
        .to(session.user.id.toString())
        .emit("mutation", ["shareUsers", postId]);
      pgEmitter
        .to(userId.toString())
        .to(session.user.id.toString())
        .emit("mutation", "chats");
      pgEmitter
        .to(session.user.id.toString())
        .emit("mutation", ["chat", userId]);
      pgEmitter
        .to(userId.toString())
        .emit("mutation", ["chat", session.user.id]);
    },
  },
  get: {
    session: async ({ trx, session }) => {
      return session ?? undefined;
    },
    posts: async ({ trx, session }) =>
      await trx
        .selectFrom("post")
        .select((s) => [
          "post.created",
          "post.description",
          "post.id",
          "post.name",
          sql<Content[]>`array_agg(row_to_json(c) order by c.id desc)`.as(
            "content"
          ),
        ])
        .innerJoin("userPost", "userPost.postId", "post.id")
        .leftJoin("postContent as pc", (j) =>
          j.onRef("pc.postId", "=", "post.id")
        )
        .innerJoin("content as c", (j) => j.onRef("c.id", "=", "pc.contentId"))
        .where("userPost.relation", "=", "owner")
        .where("userPost.userId", "=", session.user.id)
        .groupBy("post.id")
        .execute(),
    users: async ({ trx, session, filter = "all" }) => {
      return dbCommon.getUsersWithStatus(trx, session?.user.id, filter);
    },
    shareUsers: async ({ trx, session, postId }) => {
      return dbCommon.getShareUsers(trx, session.user.id, postId);
    },
    post: async ({ trx, postId, session }) => {
      return dbCommon.getPost(trx, postId, session.user.id);
    },
    content: async ({ trx, contentId, session }) => {
      return await trx
        .selectFrom("content")
        .select(["content.name", "content.id"])
        .where("content.id", "=", contentId)
        .executeTakeFirst();
    },
    chat: async ({ trx, userId, session }) => {
      const user = await trx
        .selectFrom("user")
        .select(["id", "handle"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();

      const conversations = await trx
        .selectFrom("conversation")
        .innerJoin("post", "post.id", "conversation.postId")
        .innerJoin("postContent", "postContent.postId", "post.id")
        .innerJoin("content", "content.id", "postContent.contentId")
        .innerJoin("conversationUser as cua", (join) =>
          join
            .on("cua.userId", "=", session.user.id)
            .onRef("cua.conversationId", "=", "conversation.id")
        )
        .innerJoin("conversationUser as cub", (join) =>
          join
            .on("cub.userId", "=", userId)
            .onRef("cub.conversationId", "=", "conversation.id")
        )
        .innerJoin("userPost as up", (join) =>
          join
            .on("up.userId", "=", session.user.id)
            .onRef("up.postId", "=", "conversation.postId")
        )
        .leftJoin("message as m", (j) =>
          j.onRef("m.conversationId", "=", "conversation.id")
        )
        .select((sq) => [
          jsonBuildObject({
            id: sq.ref("conversation.id"),
          }).as("conversation"),
          sql<number>`count(distinct m.id)::int`.as("messagesCount"),
          jsonBuildObject({
            id: sq.ref("post.id"),
            name: sq.ref("post.name"),
            created: sq.ref("post.created"),
            description: sq.ref("post.description"),
            relation: sq.ref("up.relation"),
          }).as("post"),
          sql<
            { name: string }[]
          >`array_agg(content.name order by content.id desc)`.as("content"),
        ])
        .orderBy("post.created")
        .groupBy(["post.id", "conversation.id", "up.relation"])
        .execute();

      return { user, conversations };
    },
    chats: async ({ trx, session }) => {
      const latestConvos = trx
        .selectFrom("latestFriendConversation as lfc")
        .innerJoin("conversation", "conversation.id", "lfc.conversationId")
        .select((sq) => [
          jsonObjectFrom(
            sq
              .selectFrom("user")
              .select(["id", "handle"])
              .whereRef("user.id", "=", "lfc.friendId")
          ).as("user"),
          jsonObjectFrom(
            sq
              .selectFrom("post")
              .select((ssq) => [
                jsonObjectFrom(
                  ssq
                    .selectFrom("post as inner")
                    .select([
                      "post.id",
                      "post.name",
                      "post.description",
                      "post.created",
                    ])
                    .whereRef("inner.id", "=", "post.id")
                ).as("post"),
                jsonObjectFrom(
                  ssq
                    .selectFrom("message")
                    .select([
                      "message.id",
                      "message.text",
                      "message.created",
                      "message.userId",
                    ])
                    .whereRef("message.id", "=", "conversation.latestMessageId")
                ).as("message"),
              ])
              .whereRef("post.id", "=", "conversation.postId")
          ).as("conversation"),
        ])
        .where("lfc.userId", "=", session.user.id);

      return await latestConvos.execute();

      // return await trx.selectFrom('conversationUser as cua')
      //     .innerJoin('conversationUser as cub', 'cub.conversationId', 'cua.conversationId')
      //     .innerJoin('user as other', 'other.id', 'cub.userId')
      //     .innerJoin('latestFriendConversation as lfc', 'lfc.conversationId', 'cua.conversationId')
      //     .innerJoin('conversation', 'conversation')
      //     .innerJoin('post', 'post.id', )
      //     .select(sq => [
      //         jsonObjectFrom(sq.selectFrom('user').select(['id', 'handle']).whereRef('user.id', '=', 'cua.userId')).as('user'),

      //     ])
      //     .where('cua.userId', '=', session.user.id)
      //     .where('other.id', '<>', session.user.id)
      //     .distinct()
      //     .execute();
    },
    conversation: async ({ conversationId, trx, session }) => {
      const conversation = await trx
        .selectFrom("conversation")
        .select([
          "conversation.id",
          "conversation.postId",
          "conversation.created",
        ])
        .where("conversation.id", "=", conversationId)
        .executeTakeFirstOrThrow();

      //const post = await dbCommon.getPost(trx, conversation.postId, session.user.id);

      const messages = await trx
        .selectFrom("message as outer")
        .select((sq) => [
          jsonObjectFrom(
            sq
              .selectFrom("message as inner")
              .select([
                "inner.conversationId",
                "inner.created",
                "inner.id",
                "inner.text",
                "inner.userId",
              ])
              .whereRef("inner.id", "=", "outer.id")
          ).as("message"),
          jsonObjectFrom(
            sq
              .selectFrom("user")
              .select(["user.id", "user.handle"])
              .whereRef("user.id", "=", "outer.userId")
          ).as("user"),
        ])
        .where("outer.conversationId", "=", conversationId)
        .execute();

      return { conversation, messages };
    },

    places: async ({ name }) => {
      const parametersObject = {
        input: name,
        types: "food",
        location: "55.6802678,12.5813901",
        radius: "1",
        // sessionToken: randomUUID(),
        key: process.env.GOOGLE_PLACES_KEY,
      };

      const parameters = Object.entries(parametersObject)
        .map(([key, value]) => `${key}=${value}`)
        .join("&");

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${parameters}`;

      const req = await axios.get<GoogleTypes.AutocompleteResponse>(url);

      return req.data.predictions;
    },

    place: async ({ trx, placeId }) =>
      await trx
        .selectFrom("place")
        .select([
          "city",
          "country",
          "street",
          "email",
          "googlePlaceId",
          "id",
          "instagram",
          "internalStatus",
          "name",
        ])
        .where("id", "=", placeId)
        .executeTakeFirst(),
  },
  put: {
    post: async ({
      trx,
      session,
      post: { id, name, description },
      content,
    }) => {
      const insert = await trx
        .insertInto("post")
        .onConflict((oc) => oc.column("id").doUpdateSet({ name, description }))
        .values({ id, name, description })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("userPost")
        .values({
          postId: insert.id,
          userId: session.user.id,
          relation: "owner",
        })
        .onConflict((oc) =>
          oc.columns(["postId", "userId", "relation"]).doNothing()
        )
        .execute();

      await trx
        .deleteFrom("postContent")
        .where("postContent.postId", "=", insert.id)
        .execute();

      if (content.length) {
        await trx
          .insertInto("postContent")
          .values(content.map((c) => ({ contentId: c.id, postId: insert.id })))
          .onConflict((oc) => oc.columns(["contentId", "postId"]).doNothing())
          .execute();
      }

      const usersWithAccess = await trx
        .selectFrom("userPost")
        .select("userId")
        .where("relation", "=", "consumer")
        .where("postId", "=", insert.id)
        .execute();

      const emitPostMutation = (userId: number) =>
        pgEmitter.to(userId.toString()).emit("mutation", ["post", insert.id]);

      pgEmitter.to(session.user.id.toString()).emit("mutation", "posts");

      emitPostMutation(session.user.id);

      for (let i = 0; i < usersWithAccess.length; i++)
        emitPostMutation(usersWithAccess[i].userId);

      return insert;
    },
    postContent: async ({ trx, postId, contentId, session }) => {
      await trx
        .insertInto("postContent")
        .values({ contentId, postId })
        .onConflict((oc) => oc.columns(["contentId", "postId"]).doNothing())
        .execute();

      pgEmitter.to(session.user.id.toString()).emit("mutation", "post");
    },
    content: async ({ trx, session }) => {
      const insert = await trx
        .insertInto("content")
        .values({ userId: session.user.id })
        .returning("content.id")
        .executeTakeFirstOrThrow();

      return insert;
    },
    user: async ({ session, trx, user, defaultHandle }) => {
      if (!Object.keys(user).length) return;

      if (defaultHandle && typeof user.handle === "string") {
        const existingHandles = await trx
          .selectFrom("user")
          .select((s) => s.fn.count("id").as("count"))
          .where("handle", "=", user.handle)
          .executeTakeFirstOrThrow();
        const floatCount = parseFloat(existingHandles.count as string);

        if (floatCount > 0) user.handle = `${user.handle}${floatCount + 1}`;
      }

      const q = trx
        .updateTable("user")
        .set({ ...user })
        .where("id", "=", session.user.id);

      await q.execute();

      pgEmitter.to(session.user.id.toString()).emit("mutation", "session");
    },
    conversation: async ({}) => {},
    friend: async ({ trx, session, userId }) => {
      const sourceUserId = session.user.id;
      const targetUserId = userId;

      if (targetUserId === session.user.id) return;

      await trx
        .insertInto("friend")
        .values({ friendId: targetUserId, userId: sourceUserId })
        .onConflict((oc) => oc.columns(["friendId", "userId"]).doNothing())
        .execute();

      pgEmitter
        .to(targetUserId.toString())
        .to(sourceUserId.toString())
        .emit("mutation", "users");
    },
    group: async ({}) => {},
    groupConversation: async ({}) => {},
    groupMember: async ({}) => {},
    message: async ({ trx, conversationId, session, text }) => {
      const insert = await trx
        .insertInto("message")
        .values({ text, conversationId, userId: session.user.id })
        .returning(["message.id", "message.created"])
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("conversation")
        .set({ latestMessageId: insert.id })
        .where("conversation.id", "=", conversationId)
        .execute();

      const { userId } = await trx
        .selectFrom("conversationUser")
        .select("conversationUser.userId")
        .where("conversationUser.conversationId", "=", conversationId)
        .where("conversationUser.userId", "<>", session.user.id)
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("latestFriendConversation")
        .set({ conversationId })
        .where("userId", "=", session.user.id)
        .where("friendId", "=", userId)
        .execute();

      pgEmitter
        .to(userId.toString())
        .to(session.user.id.toString())
        .emit("mutation", ["conversation", conversationId]);
      pgEmitter
        .to(userId.toString())
        .to(session.user.id.toString())
        .emit("mutation", "chats");

      return { id: insert.id, created: insert.created };
    },
    place: async ({ trx, googlePlaceId, description, name }) => {
      const existingPlace = await trx
        .selectFrom("place")
        .select("id")
        .where("googlePlaceId", "=", googlePlaceId)
        .executeTakeFirst();

      if (existingPlace) {
        console.log("place already exists");
        return existingPlace;
      }

      try {
        const getGooglePlace = await axios.get(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}fields=place_id&key=${process.env.GOOGLE_PLACES_KEY}`
          // `https://places.googleapis.com/v1/places/${googlePlaceId}?fields=id&key=${process.env.GOOGLE_PLACES_KEY}`
        );

        if (getGooglePlace.status !== 200) {
          console.log("google place id invalid", googlePlaceId);
          return;
        }
      } catch {
        console.log("google place id invalid in catch", googlePlaceId);
        return;
      }

      const getWebsite = async ({ url }: { url: string }) => {
        try {
          console.log("getting website", url);

          const browser = await puppeteer.launch({ headless: "new" });
          const page = await browser.newPage();

          await page.goto(url);

          await page.setViewport({ width: 2000, height: 1000 });

          await Promise.all([
            page.waitForNetworkIdle(),
            new Promise<void>((res) => setTimeout(res, 10000)),
          ]);

          const htmlStr = await page.content();

          const $ = load(htmlStr);

          return $("p, a").text().trim();
        } catch {
          return "";
        }
      };

      const queryBing = async ({ query }: { query: string }) => {
        console.log("querying bing", query);

        const apiKey = process.env.BING_API_KEY;
        const endpoint = "https://api.bing.microsoft.com/v7.0/search";

        const res = await axios.get<BingTypes.SearchResponse>(endpoint, {
          params: {
            q: query,
          },
          headers: {
            "Ocp-Apim-Subscription-Key": apiKey,
          },
        });

        return res.data;
      };

      const openai = new OpenAI();

      const content = `Given this place: "${description}", can you fill out the fields of a JSON with the following typescript type:
        \`\`\`ts
        type PlaceDescriptionParagraph = {
          text: string,
          sources: string[]
        }

        type PlaceDescription = [PlaceDescriptionParagraph]

        type Place = {
          name: string,
          street: string,
          city: string,
          country: string,
          instagramHandle: string | undefined,
          businessEmail: string | undefined
          description: placeDescription
        }
        \`\`\`

        The description should be no more than 2-3 paragraphs. Thanks a lot!
        `;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are a helpful assistant designed to output JSON. Provided a description of a place such as "Lille Petra, Kronprinsessegade, Copenhagen, Denmark", you first do a bing search to get the most recent information about the place, and then follow the instructions provided by the user to provide a complete answer from the search results. If any of the search results are relevant, but you require more info from them, you can request to load the page from the provided url.`,
        },
        { role: "user", content: content },
      ];

      const request = async () =>
        await openai.chat.completions.create({
          messages,
          seed: 1,
          top_p: 0.1,
          // model: "gpt-3.5-turbo-1106",
          model: "gpt-4-1106-preview",
          tools: [
            {
              type: "function",
              function: {
                name: "search_bing_for_information",
                description:
                  "Use this function to search the internet for the most relevant resources about a place. Input should be a search query string. Output will be a list of webpages, with snippets and other superficial info. They contain urls that can be used for further info.",
                parameters: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description:
                        "Query string for bing to use to get search results",
                    },
                  },
                  required: ["query"],
                },
              },
            },

            {
              type: "function",
              function: {
                name: "search_website_for_information",
                description:
                  "Use this function to search a website for information. Some websites will not return useful content, and in that case you will have to fall back to the snippets from the bing search results that this was based on. The text returned is a scrape, meaning it will not be formatted, and likely hard to read.",
                parameters: {
                  type: "object",
                  properties: {
                    url: {
                      type: "string",
                      description:
                        "Url of the website to be downloaded for further information",
                    },
                  },
                  required: ["url"],
                },
              },
            },
          ],
          tool_choice: "auto",
          response_format: { type: "json_object" },
        });

      let reply: string | null = null;

      const getNewCompletion = async () => {
        console.log("getting new completion");
        const completion = await request();
        const toolCalls = completion.choices[0].message.tool_calls ?? [];
        const message = completion.choices[0].message;

        messages.push(message);

        for (let i = 0; i < toolCalls.length; i++) {
          const toolCall = toolCalls[i];

          switch (toolCall.function.name) {
            case "search_website_for_information":
              const websiteResult = await getWebsite(
                JSON.parse(toolCall.function.arguments)
              );

              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: websiteResult,
              });
              break;
            case "search_bing_for_information":
              const searchResults = await queryBing(
                JSON.parse(toolCall.function.arguments)
              );

              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(searchResults.webPages),
              });
              break;
          }
        }

        reply = message.content;

        return reply === null;
      };

      const placeInsert = await trx
        .insertInto("place")
        .values({
          name: name,
          googlePlaceId: googlePlaceId,
          internalStatus: "generating",
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      new Promise<void>(async () => {
        while (await getNewCompletion());

        const data = JSON.parse(reply!) as OpenaiTypes.Place;

        for (let i = 0; i < data.description.length; i++) {
          const paragraph = data.description[i];

          const paragraphInsert = await trx
            .insertInto("paragraph")
            .values({
              ownerId: placeInsert.id,
              text: paragraph.text,
              type: "place_description",
            })
            .returning("id")
            .executeTakeFirstOrThrow();

          for (let j = 0; j < paragraph.sources.length; j++) {
            await trx
              .insertInto("paragraphUrl")
              .values({
                paragraphId: paragraphInsert.id,
                url: paragraph.sources[j],
              })
              .executeTakeFirstOrThrow();
          }
        }

        await trx
          .updateTable("place")
          .set({
            street: data.street,
            city: data.city,
            country: data.country,
            email: data.businessEmail,
            instagram: data.instagramHandle,
            internalStatus: "done",
          })
          .where("id", "=", placeInsert.id)
          .execute();

        pgEmitter.emit("mutation", ["place", placeInsert.id]);
      });

      return placeInsert;
    },
    userPost: async ({ trx, session, postId, userId, relation }) => {
      await trx
        .insertInto("userPost")
        .values({ userId, postId, relation })
        .onConflict((oc) =>
          oc.columns(["postId", "userId", "relation"]).doNothing()
        )
        .execute();

      let conversation = await trx
        .selectFrom("conversation")
        .innerJoin("conversationUser as cua", (join) =>
          join
            .onRef("cua.conversationId", "=", "conversation.id")
            .on("cua.userId", "=", session.user.id)
        )
        .innerJoin("conversationUser as cub", (join) =>
          join
            .onRef("cub.conversationId", "=", "conversation.id")
            .on("cub.userId", "=", userId)
        )
        .select("conversation.id")
        .where("conversation.postId", "=", postId)
        .executeTakeFirst();

      if (!conversation) {
        conversation = await trx
          .insertInto("conversation")
          .values({ postId })
          .returning("id")
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("conversationUser")
          .values([
            { conversationId: conversation.id, userId: session.user.id },
            { conversationId: conversation.id, userId },
          ])
          .onConflict((oc) =>
            oc.columns(["conversationId", "userId"]).doNothing()
          )
          .execute();
      }

      const conversationId = conversation.id;

      await trx
        .insertInto("latestFriendConversation")
        .values({ conversationId, friendId: userId, userId: session.user.id })
        .onConflict((oc) =>
          oc.columns(["friendId", "userId"]).doUpdateSet({ conversationId })
        )
        .execute();

      pgEmitter
        .to(session.user.id.toString())
        .emit("mutation", ["shareUsers", postId]);
      pgEmitter
        .to(userId.toString())
        .to(session.user.id.toString())
        .emit("mutation", "chats");
      pgEmitter
        .to(session.user.id.toString())
        .emit("mutation", ["chat", userId]);
      pgEmitter
        .to(userId.toString())
        .emit("mutation", ["chat", session.user.id]);
    },
  },
};
