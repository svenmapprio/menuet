import { fecthCommon } from "@/utils/serverUtils";
import { notFound } from "next/navigation";
import PostComponents from 'components/Post';
import { ReactNode } from "react";

export default async function Layout ({params, children}: {params: {postId: string}, children: ReactNode}) {
    const getPost = await fecthCommon.getPost(params.postId);
    
    if(!getPost)
        return notFound();

    return <PostComponents.View post={getPost}>
        {children}
    </PostComponents.View>
}