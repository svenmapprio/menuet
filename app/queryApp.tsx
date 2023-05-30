'use client';

import { FC, PropsWithChildren } from "react";
import {QueryClient, QueryClientProvider} from 'react-query'

const queryClient = new QueryClient();

const QueryApp: FC<PropsWithChildren> = ({children}) => {
    return <QueryClientProvider client={queryClient}>
        {children}
    </QueryClientProvider>
}

export default QueryApp;