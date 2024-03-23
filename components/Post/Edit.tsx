"use client";

import { baseUrl, domains } from "@/utils/fetch";
import { useForm } from "@/utils/form";
import { Returns } from "@/utils/routes";
import { Post } from "@/utils/tables";
import { GetContent } from "@/utils/routes";
import axios from "axios";
import { Insertable } from "kysely";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FC,
  FormEventHandler,
  FunctionComponent,
  useEffect,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  useCallback,
  useState,
  Thenable,
  useRef,
} from "react";
import { useMutation, useQuery } from "react-query";
import { number, string } from "yup";
import Input from "../Input";

type Props<T> = PropsWithChildren<{ onSubmit: (data: T) => void }>;
type FCReturns<P> = ReturnType<FC<P>>;

const Form = <T extends unknown>({
  children,
  onSubmit,
}: Props<T>): FCReturns<Props<T>> => {
  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>((e) => {
    e.preventDefault();

    const data = new FormData(e.target as HTMLFormElement);

    onSubmit(Object.fromEntries(data) as T);
  }, []);
  return <form onSubmit={handleSubmit}>{children}</form>;
};

const ContentView: FC<{ content: GetContent }> = ({
  content: { name, id },
}) => {
  const src = `https://menuet.ams3.cdn.digitaloceanspaces.com/content/${name}-200-200.webp`;

  return (
    <Image
      src={src}
      alt={"Preview of selected image"}
      height={200}
      width={200}
      style={{ objectFit: "cover" }}
    />
  );
};

export type PostModel = {
  content: { id: number; name: string }[];
  post: {
    id?: number;
    placeId?: number;
  };
  conversations: {
    user: {
      id: number;
    };
  }[];
};

const Component: FC<{
  post: PostModel;
}> = ({ post: { content, post, conversations } }) => {
  const savePost = useMutation({
    mutationFn: domains.public.put.post,
    mutationKey: ["post", post.id],
  });
  const router = useRouter();
  const [newContent, setNewContent] = useState<typeof content>([]);
  const [allContent, setAllContent] = useState<typeof content>([]);
  const [nextUsers, setNextUsers] = useState<number[]>([]);
  const [selectingPlace, setSelectingPlace] = useState(false);
  const [placeId, setPlaceId] = useState<number>();
  const [placeSearchTerm, setPlaceSearchTerm] = useState("");
  const [placeQuerySearchTerm, setPlaceQuerySearchTerm] = useState("");

  useEffect(() => {
    setPlaceId(post.placeId);
  }, [post]);

  useEffect(() => {
    setNextUsers(conversations.map((c) => c.user.id));
  }, [conversations]);

  const {
    handleSubmit,
    formState: { errors },
    register,
  } = useForm<Omit<Insertable<Post>, "placeId">>({
    model: post,
    schema: {
      description: string().transform((v) => v || null),
    },
  });

  const handleData = useCallback(
    handleSubmit(async (data) => {
      if (!placeId) {
        alert("you have to select a place");
        return;
      }

      const res = await savePost.mutateAsync({
        post: { id: post.id, placeId: placeId, ...data },
        content: allContent,
        users: nextUsers,
      });
      router.replace(`/post/view/${res.id}`);
    }),
    [post.id, allContent, placeId]
  );

  useEffect(() => {
    setAllContent([...content, ...newContent]);
  }, [content, newContent]);

  const placeTimeout = useRef<any>();

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

  const placeDetailsData = useQuery({
    queryKey: ["place", placeId],
    queryFn: async () => {
      return domains.public.get.place({ placeId: placeId! });
    },
    enabled: !!placeId,
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

  return (
    <div>
      {allContent.map((c) => (
        <ContentView key={c.id} content={c} />
      ))}
      <Input.File
        resetOnSelect={true}
        onFiles={async (files) => {
          let newContentNext: GetContent[] = [...newContent];
          for (let i = 0; i < files.length; i++) {
            const res = await axios<GetContent>(`${baseUrl}/image`, {
              method: "PUT",
              data: await files[i].arrayBuffer(),
              headers: {
                "content-type": "application/octet-stream",
              },
            });

            const content = res.data;

            newContentNext.push(content);
          }

          setNewContent(newContentNext);
        }}
      />
      {!selectingPlace ? (
        <button onClick={() => setSelectingPlace(true)}>
          {placeId
            ? placeDetailsData.isSuccess
              ? placeDetailsData.data
                ? placeDetailsData.data.place.name
                : "Place not found"
              : "Loading place ..."
            : "Select place"}
        </button>
      ) : (
        <div>
          <input
            value={placeSearchTerm}
            onChange={(e) => setPlaceSearchTerm(e.target.value)}
          />
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

                      if (res) {
                        setPlaceId(res.id);
                        setSelectingPlace(false);
                      } else {
                        alert("something went wrong selecting the place");
                      }
                    }}
                  >
                    <p>{place.description}</p>
                  </button>
                </div>
              ))
            : null}
        </div>
      )}
      <form onSubmit={handleData}>
        <input {...register("description")} />
        <button type={"submit"}>Save</button>
      </form>
    </div>
  );
};

export default Component;
