'use client';

import ManageProfile from "@/components/modals/ManageProfile";
import { Rect, StateHook } from "@/utils/types";
import { createContext, FC, PropsWithChildren, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

export const ModalKeys = ['ManageProfile', 'Test'] as const;
export type ModalKey = typeof ModalKeys[number];

type UserProfileModalProps = {

}
type ModalTargetPosition = keyof Rect;
export type TargetedOpen = {position: Partial<{bottom: ModalTargetPosition, right: ModalTargetPosition, top: ModalTargetPosition, left: ModalTargetPosition}>, offset?: {x?: number, y?: number}, target: HTMLElement};
export type PositionedOpen = {top?: number, left?: number, right?: number, bottom?: number};

export type ModalContextValue = {
    modals: {[k in ModalKey]: StateHook<boolean | TargetedOpen | PositionedOpen>};
}

const ModalContext = createContext({} as ModalContextValue);

export const ModalContextProvider: FC<PropsWithChildren> = ({children}) => {
    const modals = Object.fromEntries(ModalKeys.map(key => ([key, useState(false)]))) as ModalContextValue["modals"];
    const context = useMemo(() => {
        const value: ModalContextValue = {
            modals,
        };

        return value;
    }, [modals]);

    return <ModalContext.Provider value={context}>
        {children}
        <ManageProfile />
    </ModalContext.Provider>
}

export default ModalContext;