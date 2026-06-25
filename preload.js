"use strict";

// preload.ts
var import_electron = require("electron");
try {
  import_electron.contextBridge.exposeInMainWorld("ObsidianBridge", {
    sendExecutionPayload: (payload) => {
      try {
        const sanitized = JSON.parse(JSON.stringify(payload));
        import_electron.ipcRenderer.sendToHost("trade-execution", sanitized);
      } catch (e) {
        console.error("[Obsidian Bridge] Serialization failed:", e);
        throw e;
      }
    }
  });
} catch (err) {
  console.error("[Obsidian Bridge] Failed to expose contextBridge:", err);
}
try {
  import_electron.contextBridge.exposeInMainWorld("ElectronIPC", {
    send: (channel, payload) => {
      try {
        const sanitized = JSON.parse(JSON.stringify(payload));
        import_electron.ipcRenderer.sendToHost(channel, sanitized);
      } catch (e) {
        console.error("[ElectronIPC] Serialization failed:", e);
        throw e;
      }
    }
  });
} catch (err) {
  console.error("[ElectronIPC] Failed to expose contextBridge:", err);
}
var injectMainWorldMonkeypatch = () => {
  const patchScript = `
        (function() {
            const OriginalWorker = window.Worker;
            
            // Override global Worker constructor to intercept messages
            window.Worker = function(stringUrl, options) {
                const worker = new OriginalWorker(stringUrl, options);
                
                const originalPostMessage = worker.postMessage;
                worker.postMessage = function(message, transfer) {
                    try {
                        // Match order placement signals sent by TradingView chart engine
                        if (message && message.type === 'execute-order') {
                            if (window.ObsidianBridge && typeof window.ObsidianBridge.sendExecutionPayload === 'function') {
                                try {
                                    window.ObsidianBridge.sendExecutionPayload(message.payload);
                                } catch (e) {
                                    console.error('[Obsidian Worker Interceptor] Failed to send payload:', e);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[Obsidian Worker Interceptor] Error inspecting postMessage payload:', e);
                    }
                    return originalPostMessage.apply(this, arguments);
                };
                
                return worker;
            };
            
            window.Worker.prototype = OriginalWorker.prototype;
            
            try {
                window.Worker.toString = function() {
                    return 'function Worker() { [native code] }';
                };
            } catch (e) {
                console.error('[Obsidian Worker Interceptor] Failed to override toString:', e);
            }
            
            console.log('[Obsidian IPC] Main World Worker constructor successfully patched.');
        })();
    `;
  if (import_electron.webFrame && typeof import_electron.webFrame.executeJavaScript === "function") {
    import_electron.webFrame.executeJavaScript(patchScript);
  } else {
    try {
      const scriptEl = document.createElement("script");
      scriptEl.textContent = patchScript;
      (document.head || document.documentElement).appendChild(scriptEl);
      scriptEl.remove();
    } catch (e) {
      console.error("[Obsidian Worker Interceptor] Fallback injection failed:", e);
    }
  }
};
injectMainWorldMonkeypatch();
