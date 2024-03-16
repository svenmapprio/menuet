"use client";

import { FC, useCallback } from "react";
import { ShareUsersListItem } from "@/utils/types";
import { useMutation, useQuery } from "react-query";
import { domains } from "@/utils/fetch";
import Spinner from "../Spinner";
import { Returns } from "@/utils/routes";

const ShareUserView: FC<{ postId: number; shareUser: ShareUsersListItem }> = ({
  postId,
  shareUser,
}) => {
  const putShare = useMutation({
    mutationFn: domains.public.put.userPost,
  });

  const deleteShare = useMutation({
    mutationFn: domains.public.delete.userPost,
  });

  const handleClick = useCallback(() => {
    if (!shareUser.shared)
      putShare.mutate({
        postId: postId,
        userId: shareUser.id,
        relation: "consumer",
      });
    else deleteShare.mutate({ postId: postId, userId: shareUser.id });
  }, [putShare, deleteShare, shareUser]);

  return (
    <button onClick={handleClick}>
      {shareUser.handle} {shareUser.shared ? "yes" : "no"}
    </button>
  );
};

const Component: FC<{ post: Returns.PostDetails }> = ({ post: { post } }) => {
  const friendsData = useQuery({
    queryKey: [`shareUsers`, post.id],
    queryFn: async () => domains.public.get.shareUsers({ postId: post.id }),
  });

  return (
    <>
      <div>Share post with: </div>
      {friendsData.isLoading ? (
        <Spinner />
      ) : friendsData.isSuccess ? (
        friendsData.data.map((s) => (
          <ShareUserView postId={post.id} key={s.id} shareUser={s} />
        ))
      ) : null}
    </>
  );
};

export default Component;
