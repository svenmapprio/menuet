'use client';

import SessionContext from "@/contexts/SessionContext";
import { useContext } from "react";

const useSessionData = () => {
    return useContext(SessionContext).sessionData;
};

export default useSessionData;