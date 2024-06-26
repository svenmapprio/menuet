import puppeteer from "puppeteer";
import { load } from "cheerio";
import { BingTypes, OpenaiTypes } from "../utils/routes";
import OpenAI from "openai";
import axios from "axios";
import { db, pgEmitter } from "../utils/db";
import minimist from "minimist";

const main = async () => {
  const args = minimist(process.argv.slice(2));

  const description = args.description as string;
  const placeId = args.placeId as number;

  if (!description || !placeId) return;

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

  const content = `Given this place: "${description}", can you fill out the fields of a JSON with the following pseudo typescript type:
      \`\`\`ts
      type PlaceDescriptionParagraph = {
        text: string,
        sources: string[1-5]
      }

      type PlaceDescription = PlaceDescriptionParagraph[2-3]

      type Place = {
        name: string,
        street: string,
        city: string,
        country: string,
        instagramHandle: string | undefined,
        businessEmail: string | undefined
        description: PlaceDescription
        tags: string[3-5]
      }
      \`\`\`
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

  console.log("generating place");

  await db
    .updateTable("place")
    .set({ internalStatus: "generating" })
    .where("id", "=", placeId)
    .execute();

  pgEmitter.emit("mutation", ["place", placeId]);

  await db.transaction().execute(async (trx) => {
    try {
      while (await getNewCompletion());

      const data = JSON.parse(reply!) as OpenaiTypes.Place;

      for (let i = 0; i < data.description.length; i++) {
        const paragraph = data.description[i];

        const paragraphInsert = await trx
          .insertInto("paragraph")
          .values({
            ownerId: placeId,
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
        .where("id", "=", placeId)
        .execute();

      pgEmitter.emit("mutation", ["place", placeId]);
    } catch {
      await trx
        .updateTable("place")
        .set({ internalStatus: "generation_failed" })
        .where("id", "=", placeId)
        .execute();

      pgEmitter.emit("mutation", ["place", placeId]);
    }
  });
};

main();
