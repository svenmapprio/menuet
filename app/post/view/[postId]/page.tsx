import { fecthCommon } from "@/utils/serverUtils";
import { notFound } from 'next/navigation';
import PostComponents from 'components/Post';

export default async function({params: {postId}}: {params: {postId: string}}) {
    const getPost = await fecthCommon.getPost(postId);
    
    if(!getPost)
        return notFound();

    const {post, relations} = getPost;

    return <PostComponents.View post={post} relations={relations} />;
};