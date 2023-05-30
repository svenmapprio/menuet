'use client';

import { baseUrl, domains } from "@/utils/fetch";
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

const ContentView: FC<{content: GetContent}> = ({content: {name, id}}) => {
    const src = `https://menuet.ams3.cdn.digitaloceanspaces.com/content/${name}-200-200.webp`;
    
    return <Image src={src} alt={'Preview of selected image'} height={200} width={200} style={{objectFit: 'cover'}} />;
}

const Component: FC<{post: PutPost}> = ({post: {content,post}}) => {
    const savePost = useMutation({mutationFn: domains.public.put.post});
    const router = useRouter();
    const [newContent, setNewContent] = useState<typeof content>([]);
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
    }), [post.id, allContent]);

    useEffect(() => {
        setAllContent([...content, ...newContent]);
    }, [content, newContent]);

    return <div>
        {
            allContent.map(c => <ContentView key={c.id} content={c} />)
        }
        <Input.File resetOnSelect={true} onFiles={async files => {
            let newContentNext: GetContent[] = [...newContent];
            for(let i = 0; i < files.length; i++){
                const res = await axios<GetContent>(`${baseUrl}/image`, {
                    method: 'PUT',
                    data: await files[i].arrayBuffer(),
                    headers: {
                        'content-type': 'application/octet-stream'
                    }
                });

                const content = res.data;

                newContentNext.push(content);
            }

            setNewContent(newContentNext);
        }} />
        {/* <button onClick={handleAddContent}>Add content</button> */}
        <form onSubmit={handleData}>
            <input {...register("name")} />
            <input {...register("description")} />
            <button type={"submit"}>Save</button>
        </form>
    </div>;
}

export default Component;