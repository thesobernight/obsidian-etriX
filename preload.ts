//#region Imports
import { contextBridge, ipcRenderer, webFrame } from 'electron';
//#endregion

//#region ContextBridge Exposure
// Define the ObsidianBridge in isolated environment
try {
    contextBridge.exposeInMainWorld('ObsidianBridge', {
        sendExecutionPayload: (payload: any) => {
            // Enforce structural cloning and deep copy validation to prevent prototype pollution/prototype manipulation
            try {
                const sanitized = JSON.parse(JSON.stringify(payload));
                ipcRenderer.sendToHost('trade-execution', sanitized);
            } catch (e) {
                console.error('[Obsidian Bridge] Serialization failed:', e);
                throw e; // Rethrow to let tests/callers inspect the failure
            }
        }
    });
} catch (err) {
    console.error('[Obsidian Bridge] Failed to expose contextBridge:', err);
}

try {
    contextBridge.exposeInMainWorld('ElectronIPC', {
        send: (channel: string, payload: any) => {
            try {
                const sanitized = JSON.parse(JSON.stringify(payload));
                ipcRenderer.sendToHost(channel, sanitized);
            } catch (e) {
                console.error('[ElectronIPC] Serialization failed:', e);
                throw e;
            }
        }
    });
} catch (err) {
    console.error('[ElectronIPC] Failed to expose contextBridge:', err);
}
//#endregion

//#region Main World Monkeypatch
// Script to be injected into the guest Main World execution context
const injectMainWorldMonkeypatch = () => {
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

    // Execute script in Main World execution context
    if (webFrame && typeof webFrame.executeJavaScript === 'function') {
        webFrame.executeJavaScript(patchScript);
    } else {
        // Fallback for non-Electron environment (e.g. testing)
        try {
            const scriptEl = document.createElement('script');
            scriptEl.textContent = patchScript;
            (document.head || document.documentElement).appendChild(scriptEl);
            scriptEl.remove();
        } catch (e) {
            console.error('[Obsidian Worker Interceptor] Fallback injection failed:', e);
        }
    }
};

// Immediately execute upon script load
injectMainWorldMonkeypatch();
//#endregion
