'use client';

import { domains } from "@/utils/fetch";
import { Session } from "@/utils/types";
import { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, UseQueryResult } from "react-query";
import SocketContext from "./SocketContext";

type SessionContextValue = {
    sessionData: UseQueryResult<Session | null>,
    onSignIn(): void,
    onSignOut(): void,
};

const SessionContext = createContext({} as SessionContextValue);

export const SessionContextProvider: FC<PropsWithChildren> = ({children}) => {
    const queryClient = useQueryClient();
    const socketContext = useContext(SocketContext);
    const [googleClient, setGoogleClient] = useState<google.accounts.oauth2.CodeClient>();
    // const [code, setCode] = useState<string|null>(null);

    const deleteSession = useMutation({
        mutationFn: async () => {
          await domains.public.delete.session({});
        },
        onSuccess(){
          queryClient.invalidateQueries('session');
        }
    });

    const onSignIn = useCallback(() => {
        googleClient?.requestCode();
    }, [googleClient]);

    const onSignOut = useCallback(() => {
        // setCode(null);
        codeRef.current = null;
        deleteSession.mutate();
    }, [deleteSession]);

    const codeRef = useRef<string | null>(null);

    const sessionData = useQuery({
        queryFn: async ctx => {
            const headers = {'Authorization': codeRef.current ? `Bearer ${codeRef.current}` : ''};

            codeRef.current = null;

            const session = await domains.public.get.session({}, {headers, cache: 'no-store'});

            return session;
        },
        queryKey: ['session'],
        enabled: socketContext.isConnected,
    });

    useEffect(() => {
        if(typeof window === 'undefined') return;

        if(typeof google !== "undefined" && !googleClient){
            setGoogleClient(google.accounts.oauth2.initCodeClient({
                client_id: '40415257648-lln4524kpreapkqkh8lt18lrachk00sa.apps.googleusercontent.com',
                error_callback: async error => {
                    console.log('sign in error', error);
                },
                callback: async codeRes => {
                    codeRef.current = `google${codeRes.code}`;
                    queryClient.invalidateQueries(['session']);
                },
                scope: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
            }));
        }
    }, [typeof window, typeof google]);
   
    return <SessionContext.Provider value={{sessionData, onSignIn, onSignOut}}>
        {children}
    </SessionContext.Provider>
}

export default SessionContext;