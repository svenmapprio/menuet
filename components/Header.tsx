import ModalContext from "@/contexts/ModalContext";
import SessionContext from "@/contexts/SessionContext";
import { domains } from "@/utils/fetch";
import { ZLayers } from "@/utils/layout";
import Link from "next/link";
import { FC, useContext, useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import Spinner from "./Spinner";
import { useQuery } from 'react-query'

const initials = (str: string) => str.trim().split(/ /gm).map(s => s[0]).join("").toUpperCase();

const SessionNavComponent: FC = () => {
  const {modals: {ManageProfile: [open, setOpen]}} = useContext(ModalContext);
  const {onSignIn,onSignOut,sessionData} = useContext(SessionContext);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if(sessionData.isError)
      console.log(sessionData.error);
  }, [sessionData.isError]);
  
    return <>
      <div ref={ref} style={{height: 'calc(100% - 10px)', padding: 5, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          {
              (sessionData.isFetching && !sessionData.data) ?
              <Spinner height={"100%"} /> :
              sessionData.isSuccess ?
              sessionData.data ?
              <button onClick={e => { setOpen({target: ref.current as HTMLElement, offset: {x: 10, y: 10}, position: {top: 'bottom', right: 'right'}}) }} style={{border: "none", display: 'flex', height: "100%", aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: "25px", backgroundColor: "white"}}>
                <div style={{fontSize: 30, color: "black"}}>
                  {initials(sessionData.data.user.handle)}
                </div>
              </button> :
              <div id={'google-one-tap'} style={{height: '100%'}}>
                <button onClick={onSignIn}>Authorize me</button>
              </div> :
              null
          }
      </div>
    </>
}

const Header: FC = ({}) => {
    return <>
        <div style={{height: 30}}></div>
        <div style={{position: 'sticky', top: 0}}>
            <Link href={"/"}>Menuet</Link>
        </div>
        <div style={{position: 'fixed', top: 0, right: 0, zIndex: ZLayers.top, display: 'flex', justifyContent: 'space-between', backgroundColor: 'Background', height: '50px'}}>
            <SessionNavComponent />
        </div>
    </>
};

export default Header;