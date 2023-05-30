import QueryApp from "./queryApp";
import SocketApp from "./socketApp";
import './globals.css';
import { SessionContextProvider } from "@/contexts/SessionContext";
import Layout from "../components/Layout";
import { ModalContextProvider } from "@/contexts/ModalContext";

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
            <SocketApp>
            <SessionContextProvider>
            <ModalContextProvider>
            <Layout>
              {children}
            </Layout>
            </ModalContextProvider>
            </SessionContextProvider>
            </SocketApp>
            </QueryApp>
        </body>
      </html>
    );
}