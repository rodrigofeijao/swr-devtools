import { Runtime, runtime, storage, tabs } from "webextension-polyfill";
import type { ContentMessage } from "./content";

// Use Maps to store port connections during runtime
const contentPortMap = new Map();
const panelPortMap = new Map();

// Track the panel state and persist it
let panelIsOpen = false;

// Keep track of active tabs that had SWR initialized
const activeTabs = new Set<number>();

// Keep track of whether the service worker has been initialized
let isInitialized = false;

const debug = (...args: any[]) => {
  // console.log(...args);
};

// Persist the list of active tabs with SWR to storage
const persistActiveTabs = async () => {
  await storage.local.set({
    activeTabs: Array.from(activeTabs),
    panelIsOpen
  });
};

// Restore state from persistent storage
const restoreState = async () => {
  try {
    const result = await storage.local.get(['activeTabs', 'panelIsOpen']);
    if (result.activeTabs) {
      result.activeTabs.forEach((tabId: number) => activeTabs.add(tabId));
    }
    if (result.panelIsOpen !== undefined) {
      panelIsOpen = result.panelIsOpen;
    }
    console.log("Restored state:", { activeTabs: Array.from(activeTabs), panelIsOpen });
  } catch (err) {
    console.error("Failed to restore state:", err);
  }
};

// Keep the service worker alive in Manifest V3
function keepAlive() {
  setInterval(() => {
    // Perform a no-op action to keep the service worker alive
    runtime.getPlatformInfo();
  }, 20000); // Every 20 seconds
}

// Initialize the service worker
async function initialize() {
  if (isInitialized) return;

  console.log("Initializing SWR DevTools background service worker");

  // Restore state from persistent storage
  await restoreState();

  keepAlive();
  isInitialized = true;
}

// Initialize on install
runtime.onInstalled.addListener(async () => {
  await initialize();
});

// Initialize on startup
initialize();

// Handle extension service worker waking up
runtime.onStartup.addListener(async () => {
  await initialize();
});

runtime.onConnect.addListener((port: Runtime.Port) => {
  const tabId = port.sender?.tab?.id || +port.name.replace("panel:", "");
  console.log("on connect", { name: port.name, tabId });

  // A port between a content page
  if (port.name === "content") {
    contentPortMap.set(tabId, port);

    // Track this tab as having SWR
    activeTabs.add(tabId);
    persistActiveTabs();

    // Immediately inform content script about panel state
    port.postMessage({
      type: panelIsOpen ? "panelshow" : "panelhide",
    });

    port.onDisconnect.addListener(() => {
      console.log("disconnected content port => ", tabId);
      contentPortMap.delete(tabId);
      // We don't remove from activeTabs here as the tab might still exist
      // but just navigated away or refreshed
    });

    port.onMessage.addListener(
      (message: ContentMessage, { sender }: Runtime.Port) => {
        if (message.type === "initialized") {
          // Track this tab as having SWR
          activeTabs.add(tabId);
          persistActiveTabs();
        }

        // this might not be necessary
        const data = {
          ...message,
          tabId,
        };

        const panelPort = panelPortMap.get(tabId);
        panelPort?.postMessage(data);

        debug("sent message from content to panel", data, {
          sender,
          tabId,
          panelPortMap,
          panelPort,
        });
      },
    );
    // A port between the SWR panel in devtools
  } else if (port.name.startsWith("panel")) {
    panelPortMap.set(tabId, port);
    port.onDisconnect.addListener(() => {
      console.log("disconnected panel port => ", tabId);
      panelPortMap.delete(tabId);
    });
    port.onMessage.addListener((message) => {
      if (message.type === "panelshow") {
        panelIsOpen = true;
        persistActiveTabs();
      } else if (message.type === "panelhide") {
        panelIsOpen = false;
        persistActiveTabs();
      }

      const contentPort = contentPortMap.get(tabId);
      contentPort?.postMessage(message);

      debug("sent message from panel to content", message, contentPort);
    });
  }
});

// Listen for tab removal to clean up our active tabs list
tabs.onRemoved.addListener((tabId: number) => {
  if (activeTabs.has(tabId)) {
    activeTabs.delete(tabId);
    persistActiveTabs();
    console.log("Tab closed, removing from active tabs:", tabId);
  }
});
