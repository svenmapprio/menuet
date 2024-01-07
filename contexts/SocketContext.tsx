"use client";

import { useMutation, useQuery, useQueryClient } from "react-query";
import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { setCookie } from "nookies";
import Spinner from "@/components/Spinner";
import {
  SocketQuery,
  SocketQueryRequest,
  SocketQueryResponse,
  SocketQueryReturns,
  SocketQueryWrapper,
} from "@/utils/types";
import { domains } from "@/utils/fetch";

type SocketQueryFunction = <T extends SocketQueryRequest>(
  payload: T
) => Promise<SocketQueryReturns[T["type"]]>;

type SocketContextValue = {
  isConnected: boolean;
  isBoop: boolean | null;
  querySocket: SocketQueryFunction;
  socket: Socket | null;
};

const SocketContext = createContext({} as SocketContextValue);

const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const socket = io(
      process.env.NODE_ENV === "development"
        ? "http://localhost:4000"
        : "https://menuet.city",
      {
        transports: ["websocket"],
      }
    );

    setSocket(socket);

    return () => {
      if (socket.connected) socket.close();
    };
  }, []);

  return socket;
};

export const SocketContextProvider: FC<PropsWithChildren> = ({ children }) => {
  const socket = useSocket();
  const [isConnected, setIsConnected] = useState(false);
  const [isBoop, setIsBoop] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  // const beepQuery = useQuery({
  //   queryFn: async () => {
  //     console.log("beeping");

  //     if (socket) domains.public.get.beep({ socketId: socket.id });
  //   },
  //   queryKey: [socket?.id],
  // });
  // const beepTimerRef = useRef<any>();

  const querySocket = useCallback<SocketQueryFunction>(
    async (queryPayload: SocketQueryRequest) => {
      if (!socket) throw "missing socket";

      const queryId = Math.random().toString();
      const socketKey = `response_${queryId}`;
      const promise = new Promise<
        SocketQueryResponse<
          SocketQueryReturns[(typeof queryPayload)["type"]]
        >["data"]
      >((res) => {
        socket.once(
          socketKey,
          (
            response: SocketQueryResponse<
              SocketQueryReturns[(typeof queryPayload)["type"]]
            >
          ) => {
            res(response.data);
          }
        );
      });

      const wrapper: SocketQueryWrapper = {
        isQuery: true,
        queryId,
        queryPayload,
      };

      socket.emit("query", wrapper);

      return promise;
    },
    [socket]
  );

  useEffect(() => {
    console.log("got new socket id", socket?.id);
  }, [socket?.id]);

  useEffect(() => {
    if (socket) {
      socket.on("connect", () => {
        console.log("got socket connection", socket.id);
        setCookie(null, "socketId", socket.id, { sameSite: "strict" });
        setIsConnected(true);
        queryClient.invalidateQueries("session");
      });

      socket.on("disconnect", () => {
        console.log("socket disconnected");
        setIsConnected(false);
      });

      socket.on("mutation", (queryKey) => {
        console.log("got mutation", queryKey);

        queryClient.invalidateQueries(queryKey);
      });

      // socket.on("boop", () => {
      //   console.log("boop");

      //   setIsBoop(true);

      //   clearTimeout(beepTimerRef.current);

      //   setTimeout(() => {
      //     beepQuery.refetch();

      //     setIsBoop(null);

      //     beepTimerRef.current = setTimeout(() => {
      //       setIsBoop(false);
      //     }, 10000);
      //   }, 2000);
      // });

      return () => {
        console.log("turning off socket");
        socket.off("connect");
        socket.off("disconnect");
        socket.off("mutation");
      };
    }
  }, [socket, queryClient]);

  return (
    <SocketContext.Provider
      value={{ isBoop, isConnected, querySocket, socket }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
