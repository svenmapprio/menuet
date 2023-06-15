import { parseIntForce } from "@/utils/helpers";
import { notFound } from "next/navigation";
import Conversation from "./Conversation";

export default function Page ({params}: {params: {conversationId: string}}) {
    const conversationId = parseIntForce(params.conversationId);

    if(!conversationId) return notFound();

    return <Conversation conversationId={conversationId} />;
}