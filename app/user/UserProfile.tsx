"use client";

import TextInput from "@/components/TextInput";
import useSessionData from "@/hooks/useSessionData";
import { domains } from "@/utils/fetch";
import { Session } from "@/utils/types";
import Link from "next/link";
import { FC, ReactElement, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import * as yup from "yup";
import { Insertable } from "kysely";
import { User } from "@/utils/tables";
import { useForm } from "@/utils/form";

// type CompObject<T extends Object> = {[k in keyof T]: ReactElement};

// const typedKeys = <T extends Object>(o: T) => Object.keys(o) as (keyof T)[];

// type UseFormFieldsProps<T extends FieldValues> = {
//     model: DeepPartial<T>,
//     schema: yup.ObjectSchema<T>,
//     customFields?: (register: UseFormRegister<T>) => Partial<{[k in keyof T]: ReactElement}>
// };

// const useFormFragment = <T extends FieldValues>({model,schema,customFields}: UseFormFieldsProps<T>) => {
//     const {
//         register,
//         ...form
//     } = useForm<T>({defaultValues: model, resolver: yupResolver(schema as yup.ObjectSchema<any>)});

//     const defaultFields = Object.fromEntries<ReactElement>(typedKeys(schema.fields).map(f => ([f, <input {...register(f as Path<T>)} />]))) as CompObject<T>;
//     const fields: CompObject<T> = {...defaultFields, ...(customFields ? customFields(register) : {})};

//     return {fields, form: {register, ...form}};
// }

// type UseFormFieldsFormProps<T extends FieldValues> = UseFormFieldsProps<T> & {
//     onData?: (data: T) => Promise<void>
// }

// const Form = <T extends FieldValues>(params: UseFormFieldsFormProps<T>) => {
//     const {fields, form: {handleSubmit}} = useFormFragment(params);

//     const handleData = async (data: T) => {
//         params.onData && await params.onData(data);
//     }

//     return <form onSubmit={handleSubmit(handleData)}>
//         {...Object.values(fields)}
//     </form>
// }

const UserInfo: FC<{ session: Session }> = ({ session }) => {
  const {
    formState: { errors },
    register,
    handleSubmit,
  } = useForm<Insertable<User>>({
    model: session.user,
    schema: {
      handle: yup.string().min(5).required(),
      firstName: yup.string().required(),
      lastName: yup
        .string()
        .nullable()
        .transform((value) => value || null),
    },
  });

  const putUser = useMutation({
    mutationFn: domains.public.put.user,
  });

  const postsData = useQuery({
    queryFn: () => domains.public.get.posts({}),
    queryKey: "posts",
  });

  const handleData = handleSubmit((data) => {
    putUser.mutate({ user: data, defaultHandle: false });
  });

  return (
    <>
      <form onSubmit={handleData}>
        <input {...register("handle")} />
        <p>{errors.handle?.message}</p>
        <input {...register("firstName")} />
        <p>{errors.firstName?.message}</p>
        <input {...register("lastName")} />
        <p>{errors.lastName?.message}</p>
        <button type={"submit"}>Save</button>
      </form>
      <button>
        <Link href={"/post/edit/new"}>Make a new post</Link>
      </button>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <h2>Posts</h2>
        {postsData.data?.map((p) => (
          <Link href={`/post/view/${p.post.id}`} key={p.post.id}>
            {p.place.name}
          </Link>
        ))}
      </div>
    </>
  );
};

const UserProfile: FC = () => {
  const sessionData = useSessionData();

  return sessionData.isSuccess && sessionData.data ? (
    <UserInfo session={sessionData.data} />
  ) : null;
};

export default UserProfile;
