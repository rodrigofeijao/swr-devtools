import { SWRDevTools } from "@rodrigofeijao/swr-devtools";
import { Analytics } from "@vercel/analytics/react";
import "../styles/globals.css";

function MyApp({ Component, pageProps }) {
  return (
    <SWRDevTools>
      <Component {...pageProps} />
      <Analytics />
    </SWRDevTools>
  );
}

export default MyApp;
