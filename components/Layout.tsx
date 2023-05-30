'use client';

import { FC, PropsWithChildren } from "react";
import Header from "./Header";

const RootLayout: FC<PropsWithChildren> = ({children}) => {
    return <div style={{display: 'flex', flexDirection: 'column', width: '100vw', minHeight: '100vh', backgroundColor: 'darkblue'}}>
        <Header />
        <div style={{backgroundColor: 'brown', flex: 1, marginLeft: 'min(max(0px, calc((100% - 840px)/2)), 180px)', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 840}}>
            {children}
        </div>
    </div>;
}

export default RootLayout;