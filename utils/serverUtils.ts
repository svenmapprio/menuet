import { cookies } from "next/headers";
import { domains } from "./fetch";
import { parseIntForce } from "./helpers";

export const fecthCommon = {
    getPost: async (postIdStr: string) => {
        const postId = parseIntForce(postIdStr);

        if(!postId) return undefined;

        return await domains.public.get.post({postId}, {
            cache: 'no-store',
            cookies: cookies(),
        });
    },
    getChat: async (userIdStr: string) => {
        const userId = parseIntForce(userIdStr);

        if(!userId) return undefined;

        return await domains.public.get.chat({userId}, {
            cache: 'no-store',
            cookies: cookies(),
        });
    }
}