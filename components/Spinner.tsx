import { FC } from "react";
import { RotatingLines } from "react-loader-spinner";

const Spinner: FC<{padding?: string, width?: string, height?: string, color?: string}> = ({color = "white", height, width, padding = "20%"}) => {
    return (
        <div style={{boxSizing: "border-box", height, width, padding, aspectRatio: 1}}>
            <RotatingLines 
                width={"100%"}
                animationDuration="1"
                strokeColor={color}
                strokeWidth={"3"}
            />
        </div>
    );
}

export default Spinner;