'use client';

import {useMutation, useQuery, useQueryClient} from 'react-query';
import { FC, PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import {io, Socket} from 'socket.io-client';
import { setCookie } from 'nookies';
import Spinner from '@/components/Spinner';

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

const SocketApp: FC<PropsWithChildren> = ({children}) => {
  console.log('socket app render');
  const socket = useSocket();
  const [isConnected, setIsConnected] = useState<boolean>();
  const queryClient = useQueryClient();
  
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

  return <>
    {isConnected ? children : <Spinner />}
  </>;
}

// const FriendsList: FC = () => {
//   const users = useQuery('users', async () => {
//     return await domains.user.get.users({});
//   });

//   return <div>
//     {users.data?.map(user => <UserView user={user} key={user.id}/>)}
//   </div>
// }

// const UserView: FC<{user: UsersListItem}> = ({user}) => {
//   const putFriend = useMutation('putFriend', {mutationFn: async () => {
//     await domains.user.put.friend({userId: user.id});
//   }});
//   const removeFriend = useMutation('putFriend', {mutationFn: async () => {
//     await domains.user.delete.friend({userId: user.id});
//   }});

//   const handleClick = useCallback(async () => {
//     if(user.status === 'none' || user.status === 'other')
//       putFriend.mutate();
//     else
//       removeFriend.mutate();
//   }, [user.id, user.status]);

//   return <div key={user.id}>{user.status}, {user.handle}, {user.id} <button onClick={handleClick}>{user.status === 'both' ? 'Remove' : user.status === 'self' ? 'Cancel request' : user.status === 'other' ? 'Accept request' : 'Add friend'}</button></div>
// }

export default SocketApp;