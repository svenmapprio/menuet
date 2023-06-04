'use client';

import Spinner from "@/components/Spinner";
import { domains } from "@/utils/fetch";
import { GetChat } from "@/utils/routes";
import Link from "next/link";
import { FC } from "react";
import { useQuery } from "react-query";

const ChatView: FC<{chat: GetChat}> = ({chat: {conversations, user}}) => {
    return <div>
        <h1>Your chat with {user.handle}</h1>
        {conversations.map(c => <div key={c.post.id}><Link href={`/conversation/${c.conversation.id}`}>{c.post.name}</Link> </div>)}
    </div>
}

const Component: FC<{userId: number}> = ({userId}) => {
    const chatData = useQuery({
        queryKey: ['chat', userId],
        queryFn: () => domains.public.get.chat({userId})
    });

    return chatData.isSuccess
    ? <ChatView chat={chatData.data} /> :
    chatData.isLoading
    ? <Spinner /> : 
    null;
}

export default Component;