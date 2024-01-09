import { FC } from "react";
import PostComponents from "components/Post";
import { PutPost } from "@/utils/routes";

const postDefaults = (): PutPost => ({
  post: {
    placeId: 0,
  },
  content: [],
});

const Page: FC = () => <PostComponents.Edit post={postDefaults()} />;

export default Page;
