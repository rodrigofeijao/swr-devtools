import { devtools, runtime, storage, Runtime } from "webextension-polyfill";

// Create the DevTools panel
devtools.panels.create("SWR", "", "panel.html").then((panel) => {
  let port = connectToBackgroundScript();

  // Handle panel visibility changes
  panel.onHidden.addListener(() => {
    console.log("SWR DevTools panel hidden");
    if (port) {
      port.postMessage({ type: "panelhide" });
    }
  });

  panel.onShown.addListener(() => {
    console.log("SWR DevTools panel shown");

    // If port is not connected (service worker might have restarted),
    // establish a new connection
    if (!port) {
      port = connectToBackgroundScript();
    }

    if (port) {
      port.postMessage({ type: "panelshow" });
    }
  });

  console.log("The SWR DevTools panel has been created");
});

/**
 * Connects to the background script and sets up disconnect handler
 * to maintain connection state
 */
function connectToBackgroundScript(): Runtime.Port | null {
  try {
    // Create a new connection to the background script
    const connectionPort = runtime.connect({
      name: `panel:${devtools.inspectedWindow.tabId}`,
    });

    // We'll just log the disconnect event - the panel will create a new port when needed
    connectionPort.onDisconnect.addListener(() => {
      console.log("Disconnected from background script. Will reconnect when panel is shown.");
    });

    return connectionPort;
  } catch (error) {
    console.error("Failed to connect to background script:", error);
    return null;
  }
}
