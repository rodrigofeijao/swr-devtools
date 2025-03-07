import { DevToolsMessage } from "swr-devtools";
import { Runtime, runtime } from "webextension-polyfill";

// Inject the DevTools hook script into the page
const injectDevToolsHook = () => {
  const script = document.createElement("script");
  script.setAttribute("type", "text/javascript");
  script.setAttribute("src", chrome.runtime.getURL("web-accessible.js"));
  document.documentElement.appendChild(script);
  script.parentNode?.removeChild(script);
};
injectDevToolsHook();

export type ContentMessage =
  | {
      type: "load";
      tabId: number;
    }
  | {
      type: "initialized";
      tabId: number;
    }
  | {
      type: "updated_swr_cache";
      payload: any;
      tabId: number;
    }
  | {
      type: "load";
      tabId: number;
    }
  | {
      type: "request_start";
      payload: any;
      tabId: number;
    }
  | {
      type: "request_success";
      payload: any;
      tabId: number;
    }
  | {
      type: "request_error";
      payload: any;
      tabId: number;
    }
  | {
      type: "request_discarded";
      payload: any;
      tabId: number;
    };

// Track if the panel is open
let panelIsOpen = false;

// Store port connection to the background script
let port_: Runtime.Port | null = null;

// Store pending messages that we need to send when we reconnect
const pendingMessages: DevToolsMessage[] = [];

// Track if we're attempting to reconnect to avoid multiple reconnection attempts
let reconnectInProgress = false;

// Maximum number of reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 5;

// Current reconnection attempt count
let reconnectAttempts = 0;

// Reconnection delay in ms
const RECONNECT_DELAY = 1000;

const debug = (...args: any[]) => {
  // console.log(...args);
};

/**
 * Get or create a connection to the background script
 */
const getPort = () => {
  if (port_ !== null) return port_;

  debug("Connecting to background script");
  try {
    port_ = runtime.connect({ name: "content" });
    reconnectAttempts = 0;

    const onMessage = (message: any) => {
      debug("receive event", { message });
      if (message.type === "panelshow") {
        panelIsOpen = true;
        window.postMessage({ type: "panelshow" }, "*");
      } else if (message.type === "panelhide") {
        panelIsOpen = false;
        window.postMessage({ type: "panelhide" }, "*");
      }
    };

    // Handle messages from the background script
    port_.onMessage.addListener(onMessage);

    // Handle disconnection (service worker might have terminated)
    port_.onDisconnect.addListener(() => {
      const error = runtime.lastError;
      debug("Disconnected from background script", error);

      // Clean up
      port_?.onMessage.removeListener(onMessage);
      port_ = null;

      // Only try to reconnect if it's not already in progress and if we haven't exceeded max attempts
      if (!reconnectInProgress && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectInProgress = true;
        reconnectAttempts++;

        // Attempt to reconnect after a delay
        setTimeout(() => {
          reconnectInProgress = false;
          debug(`Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

          // This will trigger a reconnection
          sendPendingMessages();
        }, RECONNECT_DELAY * reconnectAttempts); // Exponential backoff
      } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error("Failed to reconnect to background script after multiple attempts");
      }
    });

    // Process any pending messages
    sendPendingMessages();

    return port_;
  } catch (error) {
    console.error("Error establishing connection to background script:", error);
    port_ = null;
    return null;
  }
};

/**
 * Send a message to the background script, handling reconnection if necessary
 */
const sendMessage = (message: DevToolsMessage) => {
  try {
    const port = getPort();
    if (port) {
      port.postMessage(message);
    } else {
      // Store message to send when we reconnect
      pendingMessages.push(message);
    }
  } catch (error) {
    console.error("Error sending message to background script:", error);
    // Store message to send when we reconnect
    pendingMessages.push(message);
  }
};

/**
 * Send any pending messages that were queued during disconnection
 */
const sendPendingMessages = () => {
  if (pendingMessages.length === 0) return;

  const port = getPort();
  if (!port) return;

  debug(`Sending ${pendingMessages.length} pending messages`);

  // Make a copy of the pending messages and clear the original array
  const messagesToSend = [...pendingMessages];
  pendingMessages.length = 0;

  // Send all pending messages
  for (const message of messagesToSend) {
    try {
      port.postMessage(message);
    } catch (error) {
      console.error("Failed to send pending message:", error);
      // Re-queue the message
      pendingMessages.push(message);
    }
  }
};

// A new page has been loaded - inform the background script
// Cast as any since we're sending a message that doesn't match the exact DevToolsMessage type
// but we know the background script can handle it
sendMessage({
  type: "load",
  tabId: 0  // The background script will use the port sender's tab ID
} as any);

// Listen for messages from the injected script
window.addEventListener("message", (e: MessageEvent<DevToolsMessage>) => {
  if (!e.data?.type) return;

  switch (e.data.type) {
    case "initialized": {
      sendMessage(e.data);
      // sync the status of displayed panel
      window.postMessage({ type: "load", payload: { panelIsOpen } }, "*");
      break;
    }
    case "updated_swr_cache":
    case "request_start":
    case "request_success":
    case "request_error":
    case "request_discarded": {
      if (panelIsOpen) {
        sendMessage(e.data);
      }
      break;
    }
    default: {
      // noop
    }
  }
});

// Reconnect to the background script when the page becomes visible again
// This helps with scenarios where the service worker was terminated while the page was in the background
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !port_) {
    debug("Page became visible, reconnecting to background script");
    getPort();
  }
});
