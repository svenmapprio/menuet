import QueryApp from "./queryApp";
import './globals.css';
import { SessionContextProvider } from "@/contexts/SessionContext";
import Layout from "../components/Layout";
import { ModalContextProvider } from "@/contexts/ModalContext";
import { SocketContextProvider } from "@/contexts/SocketContext";

export const metadata = {
    title: 'Menuet',
    description: 'Welcome to Menuet',
};

export default function RootLayout({
    // Layouts must accept a children prop.
    // This will be populated with nested layouts or pages
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <html lang="en">
        <head>
          <script src="https://accounts.google.com/gsi/client" async defer></script>
        </head>
        <body style={{backgroundColor: "Background"}}>
            <QueryApp>
            <SocketContextProvider>
            <SessionContextProvider>
            <ModalContextProvider>
            <Layout>
              {children}
            </Layout>
            </ModalContextProvider>
            </SessionContextProvider>
            </SocketContextProvider>
            </QueryApp>
        </body>
      </html>
    );
}