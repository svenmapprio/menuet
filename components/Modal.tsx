'use client';

import ModalContext, { ModalKey, TargetedOpen } from "@/contexts/ModalContext";
import { ZLayers, ZTops } from "@/utils/layout";
import { Rect, StateHook } from "@/utils/types";
import { FC, MouseEvent, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";

const Modal: FC<PropsWithChildren<{modalKey: ModalKey}>> = ({modalKey, children}) => {
    const context = useContext(ModalContext);
    const openState = context.modals[modalKey];
    const [open, setOpen] = openState;
    const ref = useRef<HTMLDivElement>(null);

    const handleOutsideClick = useCallback((e: Event) => {
        if(!ref.current?.contains(e.target as Node))
            setOpen(false);
    }, [ref, setOpen]);

    const [height, setHeight] = useState<number>();
    const [width, setWidth] = useState<number>();
    const [rect, setRect] = useState<Partial<Rect>>();

    const isTargetedOpen = (o: boolean | Object): o is TargetedOpen => o.hasOwnProperty("target");
    
    useEffect(() => {
        if(typeof document === 'undefined') return;
        if(typeof window === 'undefined') return;

        if(open){
            document.addEventListener('click', handleOutsideClick, false);

            if(typeof open === "boolean"){
                setRect({bottom: 0, top: 0, left: 0, right: 0});
                setWidth(undefined);
                setHeight(undefined);
            }
            else if(isTargetedOpen(open)){
                const {position,target,offset: {x = 0, y = 0} = {},} = open;
                const targetRect = target.getBoundingClientRect();

                const absolutes: {[k in keyof Rect]: (field: keyof Rect) => number} = {
                    top: (field) => field === 'top' ? targetRect.y - y : field === 'bottom' ? targetRect.y + y + targetRect.height : 0,
                    bottom: (field) => window.innerHeight - absolutes.top(field),
                    left: (field) => field === 'left' ? targetRect.x + x : field === 'right' ? targetRect.x - x + targetRect.width : 0,
                    right: (field) => window.innerWidth - absolutes.left(field),
                }
                const newRect: Partial<Rect> = {};
                
                const setField = (field: keyof Rect) => {
                    const value = position[field];
                    if(value) newRect[field] = absolutes[field](value);
                }
                (Object.keys(position) as (keyof Rect)[]).forEach(setField);

                setRect(newRect);
            }
            else{
                setRect(open);
            }
        }
        else{
            document.removeEventListener('click', handleOutsideClick, false);
        }
    }, [open, typeof window, handleOutsideClick]);

    return open ? <div onClick={() => setOpen(false)} ref={ref} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height, width, ...rect, position: 'fixed', zIndex: ZLayers.top + ZTops.Modal, }}>
        {children}
    </div> : null;
}

export default Modal;