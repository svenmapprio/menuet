"use client";

import Spinner from "@/components/Spinner";
import { domains } from "@/utils/fetch";
import { Returns } from "@/types/returnTypes";
import Link from "next/link";
import { FC } from "react";
import { useQuery } from "react-query";

const ChatView: FC<{ chat: Returns.ChatDetails }> = ({
  chat: { conversations, user },
}) => {
  console.log(conversations.map((c) => typeof c.messagesCount));
  return (
    <div>
      <h1>Your chat with {user.handle}</h1>
      {conversations.map((c) => (
        <div key={c.post.id}>
          <Link
            href={`/post/view/${c.post.id}/conversation/${c.conversation.id}`}
          >
            {c.post.place.name}
            <br />
            {c.post.relation}
            <br />
            {c.messagesCount}
          </Link>{" "}
        </div>
      ))}
    </div>
  );
};

const Component: FC<{ userId: number }> = ({ userId }) => {
  const chatData = useQuery({
    queryKey: ["chat", userId],
    queryFn: () => domains.public.get.chat({ userId }),
  });

  return chatData.isSuccess ? (
    <ChatView chat={chatData.data} />
  ) : chatData.isLoading ? (
    <Spinner />
  ) : null;
};

export default Component;
