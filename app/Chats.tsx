"use client";

import SessionContext from "@/contexts/SessionContext";
import SocketContext from "@/contexts/SocketContext";
import { domains } from "@/utils/fetch";
import { Returns } from "@/utils/routes";
import { UsersListItem } from "@/utils/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FC, useContext, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "react-query";

const Component: FC = () => {
  const socketContext = useContext(SocketContext);
  const [searchTerm, setSearchTerm] = useState("");
  const [placeSearchTerm, setPlaceSearchTerm] = useState("");
  const [querySearchTerm, setQuerySearchTerm] = useState("");
  const [placeQuerySearchTerm, setPlaceQuerySearchTerm] = useState("");
  const router = useRouter();

  useEffect(() => {
    clearTimeout(timeout.current);
    const _searchTerm = searchTerm;

    new Promise<void>((res) => (timeout.current = setTimeout(res, 150))).then(
      () => {
        if (searchTerm === _searchTerm) setQuerySearchTerm(searchTerm.trim());
      }
    );
  }, [searchTerm]);

  useEffect(() => {
    clearTimeout(placeTimeout.current);
    const _placeSearchTerm = placeSearchTerm;

    new Promise<void>(
      (res) => (placeTimeout.current = setTimeout(res, 500))
    ).then(() => {
      if (placeSearchTerm === _placeSearchTerm)
        setPlaceQuerySearchTerm(placeSearchTerm.trim());
    });
  }, [placeSearchTerm]);

  const timeout = useRef<any>();
  const placeTimeout = useRef<any>();

  const searchData = useQuery({
    queryFn: async () => {
      if (querySearchTerm && socketContext.isConnected) {
        return await socketContext.querySocket({
          type: "search",
          data: { term: querySearchTerm },
        });
      } else {
        return [];
      }
    },
    queryKey: ["users", querySearchTerm],
  });

  const placeSearchData = useQuery({
    queryFn: async () => {
      return await domains.public.get.places({ name: placeSearchTerm });
    },
    queryKey: ["places", placeQuerySearchTerm],
  });

  const putPlace = useMutation("putPlace", {
    mutationFn: domains.public.put.place,
  });

  const putFriend = useMutation("putFriend", {
    mutationFn: async (user: UsersListItem) => {
      await domains.public.put.friend({ userId: user.id });
    },
  });
  const removeFriend = useMutation("putFriend", {
    mutationFn: async (user: UsersListItem) => {
      await domains.public.delete.friend({ userId: user.id });
    },
  });

  const handleUserClick = async (user: UsersListItem) => {
    if (!user.self) await putFriend.mutateAsync(user);
    else await removeFriend.mutateAsync(user);
  };

  const session = useContext(SessionContext);

  const chatsData = useQuery({
    enabled: !!session.sessionData?.data,
    queryKey: "chats",
    queryFn: () => domains.public.get.chats(),
  });

  return (
    <>
      <div>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {searchData.isLoading
        ? "Searching users ... "
        : searchData.isSuccess
        ? searchData.data.map((u) => (
            <div style={{ display: "flex" }} key={u.id}>
              <p>{u.handle}</p>
              <button onClick={() => handleUserClick(u)}>
                {u.self ? "yes" : "no"} {u.other ? "yes" : "no"}
              </button>
            </div>
          ))
        : null}
      <div>
        {chatsData.data?.map((c) => (
          <div key={c.user.id}>
            <Link href={`/chat/${c.user.id}`}>
              <div style={{ padding: 10 }}>
                <div>{c.user.handle}</div>
                <div style={{ opacity: 0.7 }}>
                  {c.conversation.post.name}
                  {c.conversation.message
                    ? ` - ${c.conversation.message.text}`
                    : ""}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <div>
        <input
          value={placeSearchTerm}
          onChange={(e) => setPlaceSearchTerm(e.target.value)}
        />
      </div>

      {placeSearchData.isLoading
        ? "Searching places ... "
        : placeSearchData.isSuccess
        ? placeSearchData.data.map((place) => (
            <div style={{ display: "flex" }} key={place.place_id}>
              <button
                onClick={async () => {
                  const res = await putPlace.mutateAsync({
                    description: place.description,
                    googlePlaceId: place.place_id,
                    name: place.structured_formatting.main_text,
                  });

                  if (res) router.push(`/place/${res.id}`);
                }}
              >
                <p>{place.description}</p>
              </button>
            </div>
          ))
        : null}
    </>
  );
};

export default Component;
