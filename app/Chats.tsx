'use client';

import SocketContext from "@/contexts/SocketContext";
import { domains } from "@/utils/fetch";
import { UsersListItem } from "@/utils/types";
import Link from "next/link";
import { FC, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "react-query";

const Component: FC = () => {
    const socketContext = useContext(SocketContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [querySearchTerm, setQuerySearchTerm] = useState('');

    useEffect(() => {
        clearTimeout(timeout.current);
        const _searchTerm = searchTerm;

        new Promise<void>(res => timeout.current = setTimeout(res, 150)).then(() => {
            if(searchTerm === _searchTerm)
                setQuerySearchTerm(searchTerm.trim());
        });
    }, [searchTerm]);

    const timeout = useRef<any>();

    const searchData = useQuery({queryFn: async () => {
        if(querySearchTerm && socketContext.isConnected){
            return await socketContext.querySocket({type: 'search', data: {term: querySearchTerm}});
        }
        else{
            return [];
        }
    }, queryKey: ['users', querySearchTerm]});

    const putFriend = useMutation('putFriend', {mutationFn: async (user: UsersListItem) => {
        await domains.public.put.friend({userId: user.id});
    }});
    const removeFriend = useMutation('putFriend', {mutationFn: async (user: UsersListItem) => {
        await domains.public.delete.friend({userId: user.id});
    }});

    const handleUserClick = async (user: UsersListItem) => {
        if(!user.self)
            await putFriend.mutateAsync(user);
        else
            await removeFriend.mutateAsync(user);
    }

    const chatsData = useQuery({
        queryKey: 'chats',
        queryFn: () => domains.public.get.chats()
    });

    return <>
        <div>
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        {
            searchData.isLoading 
                ? 'Searching users ... ' : 
            searchData.isSuccess 
                ? searchData.data.map(u => <div style={{display: 'flex'}} key={u.id}>
                        <p>{u.handle}</p>
                        <button onClick={() => handleUserClick(u)}>{u.self ? 'yes' : 'no'} {u.other ? 'yes' : 'no'}</button>
                    </div>) : 
            null
        }
        <div>
            {chatsData.data?.map(c => <div key={c.id}>
                <Link href={`/chat/${c.id}`}>{c.handle}</Link>
            </div> )}
        </div>
    </>
}

export default Component;