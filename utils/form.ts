import { yupResolver } from "@hookform/resolvers/yup";
import {
  DeepPartial,
  FieldValues,
  useForm as useFormOrg,
} from "react-hook-form";
import * as yup from "yup";
import { ISchema, ObjectSchema } from "yup";

export type GenObjectShape<T extends Object> = { [k in keyof T]: ISchema<any> };

export const yupject = <T extends {}>(o: GenObjectShape<T>) =>
  yup.object(o).required() as any as ObjectSchema<T>;

export const useForm = <T extends FieldValues>({
  model,
  schema,
}: {
  model: DeepPartial<T>;
  schema: GenObjectShape<T>;
}) => {
  const form = useFormOrg<T>({
    defaultValues: model,
    mode: "onBlur",
    resolver: yupResolver(yupject<T>(schema) as any, {
      stripUnknown: true,
      abortEarly: false,
    }),
  });

  return form;
};
