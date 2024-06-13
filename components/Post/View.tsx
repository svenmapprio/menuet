"use client";

import { GetContent, Returns } from "@/types/returnTypes";
import Link from "next/link";
import Image from "next/image";
import { FC, PropsWithChildren } from "react";

const ContentView: FC<{ content: GetContent }> = ({
  content: { name, id },
}) => {
  const src = `https://menuet.ams3.cdn.digitaloceanspaces.com/content/${name}-200-200.webp`;

  return (
    <Image
      src={src}
      alt={"Preview of selected image"}
      height={200}
      width={200}
      style={{ objectFit: "cover" }}
    />
  );
};

const Component: FC<PropsWithChildren<{ post: Returns.PostDetails }>> = ({
  children,
  post: { post, place, content, relations, conversations },
}) => {
  const isOwner = !!relations.find((r) => r.relation === "owner");
  const isCreator = !!relations.find((r) => r.relation === "creator");
  const isConsumer = !!relations.find((r) => r.relation === "consumer");

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {content.map((c) => (
          <ContentView key={c.id} content={c} />
        ))}
      </div>
      <Link href={`/place/${place.id}`}>{place.name}</Link>
      <div>{place.name}</div>
      <div>{post.description}</div>
      {isOwner && (
        <>
          <Link href={`/post/edit/${post.id}`}>Edit</Link>
          <Link href={`/post/share/${post.id}`}>Share</Link>
        </>
      )}
      <div>
        <div>Conversations</div>
        <div style={{ display: "flex" }}>
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/post/view/${post.id}/conversation/${c.id}`}
            >
              {c.user.handle}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </>
  );
};

export default Component;
