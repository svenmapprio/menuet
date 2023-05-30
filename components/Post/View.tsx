'use client';

import { Post, UserPostRelation } from "@/utils/tables";
import { Selectable } from "kysely";
import Link from "next/link";
import { FC } from "react";

const Component: FC<{post: Selectable<Post>, relations: UserPostRelation[]}> = ({post, relations}) => {
    const isOwner = !!relations.find(r => r === 'owner');
    const isCreator = !!relations.find(r => r === 'creator');
    const isConsumer = !!relations.find(r => r === 'consumer');

    return <>
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