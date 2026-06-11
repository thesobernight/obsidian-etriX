import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ipcRenderer, contextBridge, webFrame } from 'electron';

// Import preload to trigger contextBridge exposure and monkeypatch execution
import './preload.ts';

// Capture the calls immediately after import, before any mocks are cleared in tests
const mockExpose = contextBridge.exposeInMainWorld as any;
const obsidianBridgeCall = mockExpose.mock.calls.find((c: any) => c[0] === 'ObsidianBridge');
const exposedBridge = obsidianBridgeCall ? obsidianBridgeCall[1] : null;

const mockExecute = webFrame.executeJavaScript as any;
const patchScript = mockExecute.mock.calls.length > 0 ? mockExecute.mock.calls[0][0] : null;

describe('Preload Script Unit Tests', () => {
    beforeEach(() => {
        // Clear history of ipcRenderer calls to ensure test isolation
        (ipcRenderer.sendToHost as any).mockClear();
    });

    describe('Payload Sanitization', () => {
        it('should successfully pass standard payload structures', () => {
            expect(exposedBridge).toBeDefined();
            const payload = { symbol: 'BTCUSD', qty: 1.5, side: 'buy' };
            exposedBridge.sendExecutionPayload(payload);
            expect(ipcRenderer.sendToHost).toHaveBeenCalledWith('trade-execution', payload);
        });

        it('should correctly handle nested arrays and objects', () => {
            expect(exposedBridge).toBeDefined();
            const payload = {
                symbol: 'ETHUSD',
                orders: [
                    { price: 1800, size: 2.0 },
                    { price: 1750, size: 3.0 }
                ],
                meta: { nested: [1, 2, [3, 4]] }
            };
            exposedBridge.sendExecutionPayload(payload);
            expect(ipcRenderer.sendToHost).toHaveBeenCalledWith('trade-execution', payload);
        });

        it('should filter out functions and class prototypes', () => {
            expect(exposedBridge).toBeDefined();
            class MockClass {
                prop = 'value';
                method() {
                    return 'hello';
                }
            }

            const payload = {
                symbol: 'SOLUSD',
                callback: () => console.log('execute'),
                instance: new MockClass()
            };

            exposedBridge.sendExecutionPayload(payload);

            // Expect functions to be stripped, class instances serialized to clean data objects
            const expectedSanitized = {
                symbol: 'SOLUSD',
                instance: { prop: 'value' }
            };
            expect(ipcRenderer.sendToHost).toHaveBeenCalledWith('trade-execution', expectedSanitized);
        });

        it('should throw error validations on circular object structures', () => {
            expect(exposedBridge).toBeDefined();
            const circular: any = { symbol: 'AAPL' };
            circular.self = circular;

            expect(() => {
                exposedBridge.sendExecutionPayload(circular);
            }).toThrow();
            expect(ipcRenderer.sendToHost).not.toHaveBeenCalled();
        });
    });

    describe('Worker Monkeypatch Simulation', () => {
        let mockSendExecutionPayload: any;
        let originalPostMessage: any;
        let workerInstance: any;

        beforeEach(() => {
            expect(patchScript).toBeDefined();

            originalPostMessage = vi.fn();
            class MockOriginalWorker {
                url: string;
                options: any;
                postMessage = originalPostMessage;
                constructor(url: string, options: any) {
                    this.url = url;
                    this.options = options;
                }
            }

            (window as any).Worker = MockOriginalWorker;

            mockSendExecutionPayload = vi.fn();
            (window as any).ObsidianBridge = {
                sendExecutionPayload: mockSendExecutionPayload
            };

            // Run the monkeypatch script in the local scope
            eval(patchScript);

            workerInstance = new (window as any).Worker('tradingview-feed.js', { type: 'module' });
        });

        it('should intercept execute-order worker messages and pipe them to ObsidianBridge', () => {
            const executionPayload = { symbol: 'EURUSD', action: 'sell', qty: 100000 };
            const executionMessage = { type: 'execute-order', payload: executionPayload };
            
            workerInstance.postMessage(executionMessage);
            expect(originalPostMessage).toHaveBeenCalledWith(executionMessage);
            expect(mockSendExecutionPayload).toHaveBeenCalledWith(executionPayload);
        });

        it('should bypass non-matching worker messages', () => {
            const plainMessage = { type: 'heartbeat', timestamp: Date.now() };
            workerInstance.postMessage(plainMessage);
            expect(originalPostMessage).toHaveBeenCalledWith(plainMessage);
            expect(mockSendExecutionPayload).not.toHaveBeenCalled();
        });

        it('should be resilient when window.ObsidianBridge is missing', () => {
            delete (window as any).ObsidianBridge;

            const executionPayload = { symbol: 'EURUSD', action: 'sell', qty: 100000 };
            const executionMessage = { type: 'execute-order', payload: executionPayload };

            expect(() => {
                workerInstance.postMessage(executionMessage);
            }).not.toThrow();

            expect(originalPostMessage).toHaveBeenCalledWith(executionMessage);
        });

        it('should not crash or block postMessage when message type property throws an error', () => {
            const maliciousMessage = {
                get type() {
                    throw new Error('Adversarial getter error');
                },
                payload: { symbol: 'BAD' }
            };

            expect(() => {
                workerInstance.postMessage(maliciousMessage);
            }).not.toThrow();

            expect(originalPostMessage).toHaveBeenCalled();
            expect(originalPostMessage.mock.calls[0][0]).toBe(maliciousMessage);
            expect(mockSendExecutionPayload).not.toHaveBeenCalled();
        });

        it('should pretend to be native code in toString() representation to bypass anti-tamper', () => {
            expect((window as any).Worker.toString()).toBe('function Worker() { [native code] }');
        });
    });
});
