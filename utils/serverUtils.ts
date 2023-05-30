import { cookies } from "next/headers";
import { domains } from "./fetch";
import { parseIntForce } from "./helpers";

export const fecthCommon = {
    getPost: async (postIdStr: string) => {
        const postId = parseIntForce(postIdStr);

        if(!postId) return undefined;

        const post = await domains.public.get.post({postId}, {
            cache: 'no-store',
            cookies: cookies(),
        });

        return post;
    }
}