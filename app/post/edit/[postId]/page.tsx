import { fecthCommon } from "@/utils/serverUtils";
import { notFound } from "next/navigation";
import PostComponents from "components/Post";

export const revalidate = 0;

export default async function Page({
  params: { postId },
}: {
  params: { postId: string };
}) {
  const getPost = await fecthCommon.getPost(postId);

  if (!getPost) return notFound();

  return <PostComponents.Edit post={getPost} />;
}
