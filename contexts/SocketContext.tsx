'use client';

import {useMutation, useQuery, useQueryClient} from 'react-query';
import { createContext, FC, PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import {io, Socket} from 'socket.io-client';
import { setCookie } from 'nookies';
import Spinner from '@/components/Spinner';
import { SocketQuery, SocketQueryRequest, SocketQueryResponse, SocketQueryReturns, SocketQueryWrapper } from '@/utils/types';

type SocketQueryFunction = <T extends SocketQueryRequest>(payload: T) => Promise<SocketQueryReturns[T['type']]>;

type SocketContextValue = {
    isConnected: boolean,
    querySocket: SocketQueryFunction,
};

const SocketContext = createContext({} as SocketContextValue);

const useSocket = () => {
  const [socket, setSocket] = useState<Socket|null>(null);

  useEffect(() => {
    const socket = io();

    setSocket(socket);

    return () => {
      if(socket.connected)
        socket.close();
    }
  }, []);

  return socket;
}

export const SocketContextProvider: FC<PropsWithChildren> = ({children}) => {
    const socket = useSocket();
    const [isConnected, setIsConnected] = useState(false);
    const queryClient = useQueryClient();

    const querySocket = useCallback<SocketQueryFunction>(async (queryPayload: SocketQueryRequest) => {
        if(!socket) throw 'missing socket';

        const queryId = Math.random().toString();
        const socketKey = `response_${queryId}`;
        const promise = new Promise<SocketQueryResponse<SocketQueryReturns[typeof queryPayload['type']]>['data']>(res => {
            socket.once(socketKey, (response: SocketQueryResponse<SocketQueryReturns[typeof queryPayload['type']]>) => {
                res(response.data);
            });
        });
    
        const wrapper: SocketQueryWrapper = {isQuery: true, queryId, queryPayload};
    
        socket.emit('query', wrapper);
    
        return promise;
    }, [socket]);
    
    useEffect(() => {
        if(socket){
            socket.on('connect', () => {
                setCookie(null, 'socketId', socket.id, {sameSite: 'strict'});
                queryClient.invalidateQueries('session');
                console.log('got socket connection', socket.id);
                setIsConnected(true);
            });

            socket.on('disconnect', () => {
                setIsConnected(false);
            });

            socket.on('mutation', queryKey => {
                console.log('got mutation', queryKey);
            
                queryClient.invalidateQueries(queryKey);
            });

            return () => {
                console.log('turning off socket');
                socket.off('connect');
                socket.off('disconnect');
                socket.off('mutation');
            };
        }
    }, [socket, queryClient]);
   
    return <SocketContext.Provider value={{isConnected, querySocket}}>
        {isConnected ? children : <Spinner />}
    </SocketContext.Provider>
}

export default SocketContext;