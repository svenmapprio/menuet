'use client';

import Link from "next/link";
import { FC } from "react";

const Component: FC = () => {
    return <div>
        All your chats ... 
        <button >
            <Link href={'/post/edit/new'}>
                Make a post
            </Link>
        </button>
    </div>;
}

export default Component;