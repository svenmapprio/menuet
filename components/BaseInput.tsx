import { FC, InputHTMLAttributes, useCallback, useEffect, useState } from "react";

export type InputValue = InputHTMLAttributes<HTMLInputElement>["value"];
export type ControlledInputProps<T = InputValue> = InputHTMLAttributes<HTMLInputElement> & {valueState: [T, (value: T) => void]};

const Input: FC<ControlledInputProps> = ({valueState, ...props}) => {
    const [value, setValue] = valueState;
    return <input {...props} value={value} onChange={e => setValue(e.target.value)} />;
}

export default Input;