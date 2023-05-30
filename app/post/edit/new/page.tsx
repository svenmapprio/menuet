import { FC } from "react"
import PostComponents from 'components/Post';
import { Post } from "@/utils/tables";
import { Insertable } from "kysely";
import { PutPost } from "@/utils/routes";

const postDefaults = (): PutPost => ({
  post: { 
    name: ""
  },
  content: []
});

const Page: FC = () => <PostComponents.Edit post={postDefaults()} />;

export default Page;