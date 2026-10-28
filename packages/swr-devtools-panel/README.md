# swr-devtools-panel

> **Note:** This is a fork of [koba04/swr-devtools](https://github.com/koba04/swr-devtools), which hasn't been updated since November 2023. It only exists to keep the dependencies up to date and make sure no known vulnerabilities ship with the package.

[![npm version](https://badge.fury.io/js/%40rodrigofeijao%2Fswr-devtools-panel.svg)](https://badge.fury.io/js/%40rodrigofeijao%2Fswr-devtools-panel)

This package is a React component of SWR Devtools panel. If you want to use this component as a React component, you can place it on your own.

**This package hasn't been stable yet, so its interface would be changed in the future releases.**
## Install

```
// install peerDependencies
$ pnpm add react swr styled-components
$ pnpm add @rodrigofeijao/swr-devtools @rodrigofeijao/swr-devtools-panel
```

## How to use

```jsx
import { SWRDevTools, SWRDevToolsContext } from "@rodrigofeijao/swr-devtools";
import { SWRDevToolPanel } from "@rodrigofeijao/swr-devtools-panel";
import { useContext } from "react";
import { useSWRConfig } from "swr";

const DevToolsView = () => {
  const { cache } = useSWRConfig();
  const { events } = useContext(SWRDevToolsContext);
  return <SWRDevToolPanel cache={cache} events={events} />;
};

const App = () => (
  <SWRDevTools>
    <Page />
    <DevToolsView />
  </SWRDevTools>
);
```

## LICENSE

[MIT](LICENSE)
