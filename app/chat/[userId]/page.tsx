import { parseIntForce } from "@/utils/helpers";
import { fecthCommon } from "@/utils/serverUtils";
import { notFound } from "next/navigation";
import Chat from "./Chat";

export default async function({params}: {params: {userId: string}}){
    const userId = parseIntForce(params.userId);
    
    if(!userId) return notFound();

    return <Chat userId={userId} />;
}