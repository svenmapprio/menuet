'use client';

import Post from "@/components/Post";
import Spinner from "@/components/Spinner";
import { domains } from "@/utils/fetch";
import { GetConversation, GetMessage } from "@/utils/routes";
import { Message } from "@/utils/tables";
import { Selectable } from "kysely";
import { FC, FormEvent, FormEventHandler, KeyboardEventHandler, useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "react-query";

const MessageView: FC<{message: GetMessage}> = ({message: {message,user}}) => {
    return <div>
        <div style={{fontWeight: '600'}}>{user.handle} - {message.created.toString()}</div>
        <div>{message.text}</div>
    </div>
}

const ConversationView: FC<{conversation: GetConversation}> = ({conversation:{conversation,messages,post}}) => {
    const [newMessage, setNewMessage] = useState('');
    const [rows, setRows] = useState(2);
    const [height, setHeight] = useState(35);
    const lineHeight = 18.5;

    const inputWidth = 200;

    const putMessage = useMutation({
        mutationFn: domains.public.put.message
    })

    const handleSubmit = useCallback(async () => {
        await putMessage.mutateAsync({conversationId: conversation.id, text: newMessage});
        
        setNewMessage('');
    }, [newMessage, setNewMessage]);

    const handleKeyUp = useCallback<KeyboardEventHandler<HTMLTextAreaElement>>((e) => {
        if(e.key.toLowerCase() === 'enter' && !e.shiftKey){
            e.preventDefault();
            if(!putMessage.isLoading)
                handleSubmit();
        }
    }, [rows, setRows, handleSubmit]);

    const handleKeyDown = useCallback<KeyboardEventHandler<HTMLTextAreaElement>>((e) => {
        if(e.key.toLowerCase() === 'enter' && !e.shiftKey){
            e.preventDefault();
        }
    }, [rows, setRows, handleSubmit]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if(textareaRef.current){
            const height = textareaRef.current.scrollHeight
            
            setHeight(height);
        }
    }, [textareaRef.current]);

    const handleInput: FormEventHandler<HTMLTextAreaElement> = (e) => {
        const target = e.target as HTMLTextAreaElement;
        const value = target.value;
        if(textareaRef.current){
            textareaRef.current.value = value;
            target.style.height = textareaRef.current.scrollHeight + 'px';
            setHeight(textareaRef.current.scrollHeight);
        }
    };

    return <div>
        <Post.View post={post} />
        <div>messages</div>
        <div>{messages.map(({message, user}) => <MessageView key={message.id} message={{message, user}} />)}</div>
        <div style={{position: 'relative'}}>
            <textarea onInput={handleInput} color={"rgb(0,0,0)"}  onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} placeholder={"write new message"} style={{  backgroundColor: 'darkgreen', height, width: inputWidth, resize: 'none'}} value={newMessage} onChange={e => {
                setNewMessage(e.target.value);
            }}>
            </textarea>
            <textarea ref={textareaRef} placeholder={"write new message"} style={{left: 0, top:0, opacity: 0, position: 'absolute', pointerEvents: 'none', height: lineHeight, whiteSpace: 'pre-wrap', backgroundColor: 'green', width: inputWidth, resize: 'none'}} readOnly={true} value={newMessage} />
        </div>
    </div>;
}

const Component: FC<{conversationId: number}> = ({conversationId}) => {
    const conversationData = useQuery({
        queryFn: () => domains.public.get.conversation({conversationId}),
        queryKey: ['conversation', conversationId],
    });

    return <div>
        {
            conversationData.isLoading 
            ? <Spinner /> :
            conversationData.isSuccess 
            ? <ConversationView conversation={conversationData.data} /> :
            null
        }
    </div>;
}

export default Component;