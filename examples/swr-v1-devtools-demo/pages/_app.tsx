import { SWRDevTools } from "@rodrigofeijao/swr-devtools";
import { SWRConfig } from "swr";
import "../styles/globals.css";

const fetcher = async (url) => {
  const res = await fetch(url);
  const json = await res.json();
  if (res.ok) {
    return json;
  }
  throw new Error(json.message);
};

function MyApp({ Component, pageProps }) {
  return (
    <SWRConfig value={{ fetcher }}>
      <SWRDevTools>
        <Component {...pageProps} />
      </SWRDevTools>
    </SWRConfig>
  );
}

export default MyApp;
