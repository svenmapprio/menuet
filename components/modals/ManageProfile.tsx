'use client';

import SessionContext from "@/contexts/SessionContext";
import Link from "next/link";
import { FC, useContext } from "react";
import Modal from "../Modal";

export type Props = {}

const Component: FC<Props> = () => {
    const session = useContext(SessionContext);

    return <Modal modalKey={"ManageProfile"} >
        <div style={{backgroundColor: 'green'}}>
            <Link href={"/user"}>Manage profile</Link>
            <button onClick={session.onSignOut}>Sign out</button>
        </div>
    </Modal>
};

export default Component;