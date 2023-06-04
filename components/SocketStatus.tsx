'use client';

import SocketContext from "@/contexts/SocketContext";
import { FC, useContext } from "react";
import Spinner from "./Spinner";

const Component: FC = () => {
    const socketContext = useContext(SocketContext);
    return socketContext.isConnected ? null : <Spinner height={'100%'} padding={'0%'} />;
}

export default Component;