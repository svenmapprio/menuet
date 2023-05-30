'use client';

import { FC } from "react";

const Component: FC<{onFiles: (files: FileList) => void}> = ({onFiles}) => {
    return <div>
        <input type={"file"} accept={"*"} onChange={e => {
            if(e.target.files)
                onFiles(e.target.files);
        }} />
    </div>;
}

export default Component;