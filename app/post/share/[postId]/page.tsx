import { fecthCommon } from "@/utils/serverUtils";
import { notFound } from "next/navigation";
import PostComponents from "components/Post";
import { parseIntForce } from "@/utils/helpers";

export default async function Page({
  params: { postId },
}: {
  params: { postId: string };
}) {
  const getPost = await fecthCommon.getPost(postId);

  if (!getPost) return notFound();

  return <PostComponents.Share post={getPost} />;
}
