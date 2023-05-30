'use client';

import { GetContent, GetPost } from "@/utils/routes";
import { Post, UserPostRelation } from "@/utils/tables";
import { Selectable } from "kysely";
import Link from "next/link";
import Image from "next/image";
import { FC } from "react";

const ContentView: FC<{content: GetContent}> = ({content: {name, id}}) => {
    const src = `https://menuet.ams3.cdn.digitaloceanspaces.com/content/${name}-200-200.webp`;
    
    return <Image src={src} alt={'Preview of selected image'} height={200} width={200} style={{objectFit: 'cover'}} />;
}

const Component: FC<{post: GetPost}> = ({post: {post, content, relations}}) => {
    const isOwner = !!relations.find(r => r === 'owner');
    const isCreator = !!relations.find(r => r === 'creator');
    const isConsumer = !!relations.find(r => r === 'consumer');

    return <>
        <div style={{display: 'flex', flexWrap: 'wrap'}}>
            {
                content.map(c => <ContentView key={c.id} content={c} />)
            }
        </div>
        <div>{post.name}</div>
        <div>{post.description}</div>
        {
            isOwner && <>
                <Link href={`/post/edit/${post.id}`}>Edit</Link>
                <button>Share</button>
            </>
        }
    </>;
}

export default Component;