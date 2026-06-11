//#region Imports
import { Plugin, ItemView, WorkspaceLeaf, FileSystemAdapter, Platform, Setting, PluginSettingTab, App, Notice } from 'obsidian';
import * as path from 'path';
import * as http from 'http';
//#endregion

//#region Constants
export const VIEW_TYPE_COCKPIT = 'trader-cockpit-view';
export const VIEW_TYPE_CHART = 'trader-chart-view';
//#endregion

//#region Settings
interface TraderCockpitSettings {
    webuiUrl: string;
    tradingViewUrl: string;
    partition: string;
    webhookToken: string;
    fastapiServerUrl: string;
    jwtToken: string;
}

const DEFAULT_SETTINGS: TraderCockpitSettings = {
    webuiUrl: 'http://localhost:5173',
    tradingViewUrl: 'https://www.tradingview.com/chart/',
    partition: 'persist:trader-cockpit',
    webhookToken: '',
    fastapiServerUrl: 'http://127.0.0.1:8001',
    jwtToken: ''
};
//#endregion

//#region WebviewFactory
function configureSandboxedWebview(
    webview: HTMLElement & { setAttribute(name: string, value: string): void },
    src: string,
    partition: string,
    preloadUrl?: string,
) {
    webview.className = 'trader-cockpit-webview';
    webview.setAttribute('src', src);
    webview.setAttribute('partition', partition);
    webview.setAttribute('allowpopups', '');
    webview.setAttribute('nodeintegration', 'false');
    webview.setAttribute('contextisolation', 'true');
    webview.setAttribute('webpreferences', 'contextIsolation=true, nodeIntegration=false');

    if (preloadUrl) {
        webview.setAttribute('preload', preloadUrl);
    }
}
//#endregion

//#region CockpitView
export class CockpitView extends ItemView {
    private webviewEl: HTMLElement | null = null;
    private plugin: TraderCockpitPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: TraderCockpitPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_COCKPIT;
    }

    getDisplayText(): string {
        return 'Trader Cockpit';
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();

        if (!Platform.isDesktop) {
            container.createEl('div', { 
                text: 'Trading Cockpit requires Obsidian Desktop (Electron) to load WebViews.',
                cls: 'webview-error-message'
            });
            return;
        }

        const viewContainer = container.createEl('div', { cls: 'trader-cockpit-container' });

        const webview = document.createElement('webview') as any;
        configureSandboxedWebview(webview, this.plugin.settings.webuiUrl, this.plugin.settings.partition);
        
        const adapter = this.app.vault.adapter;
        if (adapter instanceof FileSystemAdapter) {
            const pluginDir = `${this.app.vault.configDir}/plugins/obsidian-trader-cockpit`;
            const absolutePluginDir = adapter.getFullPath(pluginDir);
            const preloadFilePath = path.join(absolutePluginDir, 'preload.js');
            
            const preloadUrl = 'file://' + (process.platform === 'win32' 
                ? preloadFilePath.replace(/\\/g, '/') 
                : preloadFilePath);

            webview.setAttribute('preload', preloadUrl);
        }

        webview.addEventListener('ipc-message', (event: any) => {
            const { channel, args } = event;
            if (channel === 'trade-execution') {
                this.plugin.handleTradeExecution(args[0]);
            } else if (channel === 'telemetry-event') {
                this.plugin.handleTelemetry(args[0]);
            }
        });

        this.webviewEl = webview;
        viewContainer.appendChild(webview);
    }

    async onClose() {
        if (this.webviewEl) {
            this.webviewEl.remove();
        }
    }
}
//#endregion

//#region ChartView
export class ChartView extends ItemView {
    private webviewEl: HTMLElement | null = null;
    private plugin: TraderCockpitPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: TraderCockpitPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_CHART;
    }

    getDisplayText(): string {
        return 'Trader Chart';
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();

        if (!Platform.isDesktop) {
            container.createEl('div', { 
                text: 'Trading Chart requires Obsidian Desktop (Electron) to load WebViews.',
                cls: 'webview-error-message'
            });
            return;
        }

        const viewContainer = container.createEl('div', { cls: 'trader-cockpit-container' });

        const webview = document.createElement('webview') as any;
        configureSandboxedWebview(webview, this.plugin.settings.tradingViewUrl, this.plugin.settings.partition);
        
        const adapter = this.app.vault.adapter;
        if (adapter instanceof FileSystemAdapter) {
            const pluginDir = `${this.app.vault.configDir}/plugins/obsidian-trader-cockpit`;
            const absolutePluginDir = adapter.getFullPath(pluginDir);
            const preloadFilePath = path.join(absolutePluginDir, 'preload.js');
            
            const preloadUrl = 'file://' + (process.platform === 'win32' 
                ? preloadFilePath.replace(/\\/g, '/') 
                : preloadFilePath);
                
            webview.setAttribute('preload', preloadUrl);
        }

        webview.addEventListener('ipc-message', (event: any) => {
            const { channel, args } = event;
            if (channel === 'trade-execution') {
                this.plugin.handleTradeExecution(args[0]);
            } else if (channel === 'telemetry-event') {
                this.plugin.handleTelemetry(args[0]);
            }
        });

        this.webviewEl = webview;
        viewContainer.appendChild(webview);
    }

    async onClose() {
        if (this.webviewEl) {
            this.webviewEl.remove();
        }
    }
}
//#endregion

//#region MainPlugin
export default class TraderCockpitPlugin extends Plugin {
    settings!: TraderCockpitSettings;
    private receiverServer: http.Server | null = null;

    async onload() {
        await this.loadSettings();
        this.startReceiverServer();

        // Register views
        this.registerView(
            VIEW_TYPE_COCKPIT,
            (leaf) => new CockpitView(leaf, this)
        );

        this.registerView(
            VIEW_TYPE_CHART,
            (leaf) => new ChartView(leaf, this)
        );

        // Ribbon buttons
        this.addRibbonIcon('gauge', 'Open Trader Cockpit', () => {
            this.activateView(VIEW_TYPE_COCKPIT);
        });

        this.addRibbonIcon('trending-up', 'Open TradingView Chart', () => {
            this.activateView(VIEW_TYPE_CHART);
        });

        // Commands
        this.addCommand({
            id: 'open-trader-cockpit',
            name: 'Open Trader Cockpit',
            callback: () => this.activateView(VIEW_TYPE_COCKPIT)
        });

        this.addCommand({
            id: 'open-trader-chart',
            name: 'Open TradingView Chart',
            callback: () => this.activateView(VIEW_TYPE_CHART)
        });

        this.addCommand({
            id: 'sync-vault-journals',
            name: 'Sync Vault Journals',
            callback: () => this.syncVaultJournals()
        });

        // Settings tab
        this.addSettingTab(new TraderCockpitSettingTab(this.app, this));
    }

    async onunload() {
        this.stopReceiverServer();
        // Workspace view cleanup is handled by Obsidian lifecycle calling onClose() on views
    }

    private startReceiverServer() {
        const port = 27182;
        this.receiverServer = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/signal') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', async () => {
                    try {
                        const signalPayload = JSON.parse(body);
                        await this.forwardSignalToBackend(signalPayload);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'success', message: 'Signal forwarded' }));
                    } catch (err) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'error', detail: err.message }));
                    }
                });
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', detail: 'Not Found' }));
            }
        });

        this.receiverServer.on('error', (err: any) => {
            console.error('[Trader Cockpit] Receiver server error:', err);
            if (err.code === 'EADDRINUSE') {
                new Notice('Trader Cockpit: Port 27182 is already in use. Local webhook bridge disabled.');
            }
        });

        this.receiverServer.listen(port, '127.0.0.1', () => {
            console.log(`[Trader Cockpit] Embedded Receiver server listening on 127.0.0.1:${port}`);
        });
    }

    private stopReceiverServer() {
        if (this.receiverServer) {
            this.receiverServer.close();
            this.receiverServer = null;
            console.log('[Trader Cockpit] Embedded Receiver server stopped.');
        }
    }

    private async forwardSignalToBackend(payload: any) {
        const url = `${this.settings.fastapiServerUrl}/api/webhook/signal`;
        const headers = {
            'Content-Type': 'application/json',
            'X-Webhook-Token': this.settings.webhookToken
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`FastAPI rejection: ${response.status} - ${errBody}`);
        }
    }

    getJwtToken(): string {
        return this.settings.jwtToken || '';
    }

    async syncVaultJournals() {
        const files = this.app.vault.getMarkdownFiles();
        const syncPayload: any[] = [];

        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache && cache.frontmatter) {
                const fm = cache.frontmatter;
                // Validate presence of essential trading frontmatter fields
                if (fm.symbol && fm.action && fm.price && fm.size && fm.status) {
                    let parsedDate = '';
                    if (fm.date) {
                        const d = new Date(fm.date);
                        if (!isNaN(d.getTime())) {
                            parsedDate = d.toISOString();
                        } else {
                            parsedDate = String(fm.date);
                        }
                    }

                    syncPayload.push({
                        file_path: file.path,
                        date: parsedDate,
                        symbol: String(fm.symbol).toUpperCase(),
                        action: String(fm.action).toUpperCase(),
                        price: Number(fm.price),
                        size: Number(fm.size),
                        status: String(fm.status).toUpperCase(),
                        notes: fm.notes || ''
                    });
                }
            }
        }

        if (syncPayload.length === 0) {
            new Notice('No journals with valid trading frontmatter found to sync.');
            return;
        }

        // Send payload to FastAPI endpoint
        const url = `${this.settings.fastapiServerUrl}/api/journal/sync`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getJwtToken()}`
                },
                body: JSON.stringify({ logs: syncPayload })
            });
            
            if (response.ok) {
                new Notice(`Successfully synced ${syncPayload.length} journals to database.`);
            } else {
                const errText = await response.text();
                new Notice(`Failed to synchronize journals: ${response.status} - ${errText}`);
            }
        } catch (e) {
            console.error('[Trader Cockpit] Journal sync failed:', e);
            new Notice(`Failed to synchronize journals: ${e.message}`);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView(viewType: string) {
        const { workspace } = this.app;
        
        let leaf = workspace.getLeavesOfType(viewType)[0];
        if (!leaf) {
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({ type: viewType, active: true });
        }
        
        workspace.revealLeaf(leaf);
    }

    handleTradeExecution(payload: any) {
        console.log('[Host] Trade payload received:', payload);
        
        const symbol = payload.symbol || payload.ticker || 'Unknown Ticker';
        const direction = payload.direction || payload.action || payload.side || 'Unknown Direction';
        const lots = payload.lots || payload.qty || payload.quantity || payload.volume || '0';
        
        new Notice(`Trade Captured:\nSymbol: ${symbol}\nLots: ${lots}\nDirection: ${direction}`);
    }

    handleTelemetry(data: any) {
        console.log('[Host Cockpit View] Telemetry event received:', data);
    }
}
//#endregion

//#region SettingsTab
class TraderCockpitSettingTab extends PluginSettingTab {
    plugin: TraderCockpitPlugin;

    constructor(app: App, plugin: TraderCockpitPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Trader Cockpit Settings' });

        new Setting(containerEl)
            .setName('WebUI URL')
            .setDesc('The URL of the local or remote React Cockpit WebUI.')
            .addText(text => text
                .setPlaceholder('http://localhost:5173')
                .setValue(this.plugin.settings.webuiUrl)
                .onChange(async (value) => {
                    this.plugin.settings.webuiUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('TradingView Chart URL')
            .setDesc('The URL of the TradingView chart to load and intercept.')
            .addText(text => text
                .setPlaceholder('https://www.tradingview.com/chart/')
                .setValue(this.plugin.settings.tradingViewUrl)
                .onChange(async (value) => {
                    this.plugin.settings.tradingViewUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('WebView Partition')
            .setDesc('Electron session partition for persisting user logins, cookies, and local storage.')
            .addText(text => text
                .setPlaceholder('persist:trader-cockpit')
                .setValue(this.plugin.settings.partition)
                .onChange(async (value) => {
                    this.plugin.settings.partition = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('FastAPI Server URL')
            .setDesc('Local FastAPI backend URL (e.g. http://127.0.0.1:8001).')
            .addText(text => text
                .setPlaceholder('http://127.0.0.1:8001')
                .setValue(this.plugin.settings.fastapiServerUrl)
                .onChange(async (value) => {
                    this.plugin.settings.fastapiServerUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Webhook Token')
            .setDesc('User-specific webhook token for authenticating TradingView alert forwarding.')
            .addText(text => text
                .setPlaceholder('Enter X-Webhook-Token')
                .setValue(this.plugin.settings.webhookToken)
                .onChange(async (value) => {
                    this.plugin.settings.webhookToken = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('JWT Bearer Token')
            .setDesc('JWT access token used for synchronizing Markdown trade journals.')
            .addText(text => text
                .setPlaceholder('Enter JWT access token')
                .setValue(this.plugin.settings.jwtToken)
                .onChange(async (value) => {
                    this.plugin.settings.jwtToken = value;
                    await this.plugin.saveSettings();
                }));
    }
}
//#endregion
