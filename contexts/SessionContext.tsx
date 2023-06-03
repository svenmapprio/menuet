'use client';

import { domains } from "@/utils/fetch";
import { Session } from "@/utils/types";
import { createContext, FC, PropsWithChildren, useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient, UseQueryResult } from "react-query";

type SessionContextValue = {
    sessionData: UseQueryResult<Session | null>,
    onSignIn(): void,
    onSignOut(): void,
};

const SessionContext = createContext({} as SessionContextValue);

export const SessionContextProvider: FC<PropsWithChildren> = ({children}) => {
    const queryClient = useQueryClient();
    const [googleClient, setGoogleClient] = useState<google.accounts.oauth2.CodeClient>();
    const [code, setCode] = useState<string|null>(null);

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
        setCode(null);
        deleteSession.mutate();
    }, [deleteSession]);

    const sessionData = useQuery({
        queryFn: async args => {
          const headers = {'Authorization': code ? `Bearer ${code}` : ''};
    
          setCode(null);
    
          return await domains.public.get.session({}, {headers});
        },
        queryKey: 'session'
    });

    useEffect(() => {
        if(typeof window === 'undefined') return;

        if(typeof google !== "undefined" && !googleClient){
            setGoogleClient(google.accounts.oauth2.initCodeClient({
                client_id: '40415257648-lln4524kpreapkqkh8lt18lrachk00sa.apps.googleusercontent.com',
                callback: async codeRes => {
                    setCode(codeRes.code);
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