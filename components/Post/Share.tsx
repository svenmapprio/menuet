'use client';

import { GetContent, GetPost } from "@/utils/routes";
import { Post, UserPostRelation } from "@/utils/tables";
import { Selectable } from "kysely";
import Link from "next/link";
import Image from "next/image";
import { FC, useCallback } from "react";
import { ShareUsersListItem, UsersListItem } from "@/utils/types";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { domains } from "@/utils/fetch";
import Spinner from "../Spinner";

const ShareUserView: FC<{postId: number, shareUser: ShareUsersListItem}> = ({postId, shareUser}) => {
    const putShare = useMutation({
        mutationFn: domains.public.put.userPost
    });

    const deleteShare = useMutation({
        mutationFn: domains.public.delete.userPost
    });

    const handleClick = useCallback(() => {
        if(!shareUser.shared)
            putShare.mutate({postId: postId, userId: shareUser.id, relation: 'consumer'});
        else
            deleteShare.mutate({postId: postId, userId: shareUser.id});
    }, [putShare, deleteShare, shareUser]);

    return <button onClick={handleClick}>
        {shareUser.handle} {shareUser.shared ? 'yes' : 'no'}
    </button>
}

const Component: FC<{post: GetPost}> = ({post: {post}}) => {
    const friendsData = useQuery({
        queryKey: [`shareUsers`, post.id],
        queryFn: async () => domains.public.get.shareUsers({postId: post.id})
    });

    return <>
    <div>Share {post.name} with: </div>
        {
            friendsData.isLoading 
            ? <Spinner /> :
            friendsData.isSuccess 
            ? friendsData.data.map(s => <ShareUserView postId={post.id} key={s.id} shareUser={s} />) :
            null
        }
    </>;
}

export default Component;