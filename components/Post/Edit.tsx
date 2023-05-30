'use client';

import { domains } from "@/utils/fetch";
import { useForm } from "@/utils/form";
import { GetPost, PublicRoutes, PutPost } from "@/utils/routes";
import { Post } from "@/utils/tables";
import { Routes } from "@/utils/types";
import { GetContent } from "@/utils/routes";
import axios from "axios";
import { Insertable } from "kysely";
import { UnwrapPromise } from "next/dist/lib/coalesced-function";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FC, FormEventHandler, FunctionComponent, useEffect, PropsWithChildren, ReactElement, ReactNode, useCallback, useState, Thenable } from "react";
import { useMutation } from "react-query";
import { string } from "yup";
import Input from "../Input";

type Props<T> = PropsWithChildren<{onSubmit: (data: T) => void}>
type FCReturns<P> = ReturnType<FC<P>>;

const Form = <T extends unknown>({children, onSubmit}: Props<T>): FCReturns<Props<T>> => {
    const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>((e) => {
        e.preventDefault();

        const data = new FormData(e.target as HTMLFormElement);

        onSubmit(Object.fromEntries(data) as T);
    }, [])
    return <form onSubmit={handleSubmit}>
        {children}
    </form>
}

const ContentView: FC<{contentId: number}> = ({}) => {
    const [src, setSrc] = useState<string>();

    return <>
        {!!src && <Image src={src} alt={'Preview of selected image'} height={500} width={500} />}
        <Input.File onFiles={async files => {
            for(let i = 0; i < files.length; i++){
                const content = await axios<GetContent>('http://localhost:8080/api/image', {
                    method: 'POST',
                    data: await files[i].arrayBuffer(),
                    headers: {
                        'content-type': 'application/octet-stream'
                    }
                });

                console.log(content);

                // const res = await fetch('http://localhost:8080/api/image/preview', {
                //     method: 'POST',
                //     body: await files[i].arrayBuffer(),
                //     headers: {
                //         'content-type': 'application/octet-stream'
                //     }
                // });

                // const blob = await res.blob();

                // setSrc(URL.createObjectURL(blob));

                // await fetch('http://localhost:8080/api/image/1234', {
                //     method: 'PUT', 
                //     body: await files[i].arrayBuffer(),
                //     headers: {
                //         'content-type': 'application/octet-stream'
                //     }
                // });
            }
        }} />
    </>
}

const Component: FC<{post: PutPost}> = ({post: {content,post}}) => {
    const savePost = useMutation({mutationFn: domains.public.put.post});
    const addContent = useMutation({mutationFn: domains.public.put.content});
    const addPostContent = useMutation({mutationFn: domains.public.put.postContent});
    const router = useRouter();
    const [allContent, setAllContent] = useState<typeof content>([]);

    const {handleSubmit, formState: {errors}, register} = useForm<Insertable<Post>>({
        model: post,
        schema: {
            name: string().required(),
            description: string().transform(v => v || null),
        }
    });

    const handleData = useCallback(handleSubmit(async data => {
        const res = await savePost.mutateAsync({post: {id: post.id, ...data}, content: allContent});
        router.replace(`/post/view/${res.id}`);
        console.log(data);
    }), [content, post.id]);

    const handleAddContent = async () => {
        
    }

    return <div>
        <button onClick={handleAddContent}>Add content</button>
        <form onSubmit={handleData}>
            <input {...register("name")} />
            <input {...register("description")} />
            <button type={"submit"}>Save</button>
        </form>
    </div>;
}

export default Component;