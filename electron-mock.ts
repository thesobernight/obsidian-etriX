import { vi } from 'vitest';

export const ipcRenderer = {
    sendToHost: vi.fn(),
};

export const contextBridge = {
    exposeInMainWorld: vi.fn(),
};

export const webFrame = {
    executeJavaScript: vi.fn(),
};
