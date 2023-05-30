'use client';

import { FC } from "react";

const Component: FC<{resetOnSelect?: boolean, onFiles: (files: FileList) => void}> = ({resetOnSelect, onFiles}) => {
    return <div>
        <input type={"file"} accept={"*"} onChange={e => {
            if(e.target.files)
                onFiles(e.target.files);

            if(resetOnSelect)
                e.target.value = '';
        }} />
    </div>;
}

export default Component;