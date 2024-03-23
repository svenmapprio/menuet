import { FC } from "react";
import PostComponents from "components/Post";
import { PostModel } from "@/components/Post/Edit";

const postDefaults = (): PostModel => ({
  content: [],
  conversations: [],
  post: {},
});

const Page: FC = () => <PostComponents.Edit post={postDefaults()} />;

export default Page;
