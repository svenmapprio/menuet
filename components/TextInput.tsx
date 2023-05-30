import { FC, InputHTMLAttributes } from "react";
import Input, { ControlledInputProps } from "./BaseInput";

const TextInput: FC<ControlledInputProps<string>> = ({valueState, ...props}) => {
    return <Input {...props} valueState={valueState as ControlledInputProps["valueState"]} />;
}

export default TextInput;