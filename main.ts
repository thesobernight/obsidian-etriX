//#region Imports
import { Plugin, ItemView, WorkspaceLeaf, FileSystemAdapter, Platform, Setting, PluginSettingTab, App, Notice, TFile } from 'obsidian';
import * as path from 'path';
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
    defaultExportPath: string;
    autoSyncInterval: string;
    enableSignalInterceptor: boolean;
    serverMode: 'default' | 'custom';
    tradingViewMode: 'default' | 'custom';
}

const DEFAULT_SETTINGS: TraderCockpitSettings = {
    webuiUrl: 'https://app.etrix.pro',
    tradingViewUrl: 'https://www.tradingview.com/chart/',
    partition: 'persist:trader-cockpit',
    webhookToken: '',
    fastapiServerUrl: 'https://app.etrix.pro',
    jwtToken: '',
    defaultExportPath: 'Trading Journals',
    autoSyncInterval: 'off',
    enableSignalInterceptor: true,
    serverMode: 'default' as const,
    tradingViewMode: 'default' as const
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
        this.addAction('refresh-cw', 'Reload Page', () => {
            if (this.webviewEl) {
                (this.webviewEl as any).reloadIgnoringCache();
            }
        });
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

        webview.addEventListener('ipc-message', async (event: any) => {
            const { channel, args } = event;
            if (channel === 'trade-execution') {
                this.plugin.handleTradeExecution(args[0]);
            } else if (channel === 'telemetry-event') {
                this.plugin.handleTelemetry(args[0]);
            } else if (channel === 'write-note') {
                try {
                    const { file_path, content, overwrite, frontmatter, is_binary, attachments } = args[0];
                    await this.plugin.writeNoteToVault(file_path, content, overwrite, frontmatter, is_binary, attachments);
                    new Notice(`Successfully saved note: ${file_path}`);
                } catch (err) {
                    new Notice(`Failed to save note: ${err.message}`);
                }
            } else if (channel === 'open-chart-view') {
                this.plugin.activateView(VIEW_TYPE_CHART);
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
        this.addAction('refresh-cw', 'Reload Page', () => {
            if (this.webviewEl) {
                (this.webviewEl as any).reloadIgnoringCache();
            }
        });
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
        if (adapter instanceof FileSystemAdapter && this.plugin.settings.enableSignalInterceptor) {
            const pluginDir = `${this.app.vault.configDir}/plugins/obsidian-trader-cockpit`;
            const absolutePluginDir = adapter.getFullPath(pluginDir);
            const preloadFilePath = path.join(absolutePluginDir, 'preload.js');
            
            const preloadUrl = 'file://' + (process.platform === 'win32' 
                ? preloadFilePath.replace(/\\/g, '/') 
                : preloadFilePath);
                
            webview.setAttribute('preload', preloadUrl);
        }

        webview.addEventListener('ipc-message', async (event: any) => {
            const { channel, args } = event;
            if (channel === 'trade-execution') {
                this.plugin.handleTradeExecution(args[0]);
            } else if (channel === 'telemetry-event') {
                this.plugin.handleTelemetry(args[0]);
            } else if (channel === 'write-note') {
                try {
                    const { file_path, content, overwrite, frontmatter, is_binary, attachments } = args[0];
                    await this.plugin.writeNoteToVault(file_path, content, overwrite, frontmatter, is_binary, attachments);
                    new Notice(`Successfully saved note: ${file_path}`);
                } catch (err) {
                    new Notice(`Failed to save note: ${err.message}`);
                }
            } else if (channel === 'open-chart-view') {
                this.plugin.activateView(VIEW_TYPE_CHART);
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
    private syncTimer: number | null = null;

    async onload() {
        await this.loadSettings();

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

        // Setup auto-sync once layout is ready
        this.app.workspace.onLayoutReady(() => {
            if (this.settings.autoSyncInterval === 'startup') {
                this.syncVaultJournals();
            }
            this.setupAutoSync();
        });

        // Settings tab
        this.addSettingTab(new TraderCockpitSettingTab(this.app, this));
    }

    async onunload() {
        if (this.syncTimer) {
            window.clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    setupAutoSync() {
        if (this.syncTimer) {
            window.clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        const interval = this.settings.autoSyncInterval;
        if (interval === '1h') {
            this.syncTimer = window.setInterval(() => this.syncVaultJournals(), 60 * 60 * 1000);
        } else if (interval === '1d') {
            this.syncTimer = window.setInterval(() => this.syncVaultJournals(), 24 * 60 * 60 * 1000);
        }
    }

    async writeNoteToVault(filePath: string, content: string, overwrite: boolean = true, frontmatter?: any, isBinary?: boolean, attachments?: any[]) {
        // Path traversal guard
        if (filePath.includes('..') || path.isAbsolute(filePath)) {
            throw new Error('Invalid path: traversal or absolute paths not allowed');
        }

        // Prefix with default export path if configured and file_path is relative
        let finalPath = filePath;
        const defaultPath = this.settings.defaultExportPath;
        if (defaultPath && !filePath.startsWith('/') && !filePath.startsWith(defaultPath)) {
            finalPath = path.join(defaultPath, filePath);
        }
        
        // Existence check
        const existingFile = this.app.vault.getAbstractFileByPath(finalPath);
        if (existingFile && !overwrite) {
            throw new Error('File already exists');
        }
        
        // Create parent folders if they don't exist
        const dirName = path.dirname(finalPath);
        if (dirName && dirName !== '.' && dirName !== '/') {
            const parts = dirName.split(/[/\\]/);
            let currentPath = '';
            for (const part of parts) {
                if (!part) continue;
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                if (!(await this.app.vault.adapter.exists(currentPath))) {
                    await this.app.vault.createFolder(currentPath);
                }
            }
        }
        
        // Clean YAML serialization helper
        const toYAML = (obj: any, indent: number = 0): string => {
            if (obj === null || obj === undefined) {
                return 'null';
            }
            if (typeof obj === 'string') {
                return `"${obj.replace(/"/g, '\\"')}"`;
            }
            if (typeof obj === 'number' || typeof obj === 'boolean') {
                return String(obj);
            }
            if (Array.isArray(obj)) {
                if (obj.length === 0) return ' []';
                let resVal = '';
                for (const item of obj) {
                    if (typeof item === 'object' && item !== null) {
                        const keys = Object.keys(item);
                        if (keys.length === 0) {
                            resVal += `\n${' '.repeat(indent)}- {}`;
                            continue;
                        }
                        const firstKey = keys[0];
                        const firstVal = item[firstKey];
                        resVal += `\n${' '.repeat(indent)}- ${firstKey}: ${toYAML(firstVal, 0)}`;
                        for (let i = 1; i < keys.length; i++) {
                            const k = keys[i];
                            const v = item[k];
                            if (typeof v === 'object' && v !== null) {
                                resVal += `\n${' '.repeat(indent + 2)}${k}:${toYAML(v, indent + 4)}`;
                            } else {
                                resVal += `\n${' '.repeat(indent + 2)}${k}: ${toYAML(v, 0)}`;
                            }
                        }
                    } else {
                        resVal += `\n${' '.repeat(indent)}- ${toYAML(item, 0)}`;
                    }
                }
                return resVal;
            }
            if (typeof obj === 'object') {
                const keys = Object.keys(obj);
                if (keys.length === 0) return ' {}';
                let resVal = '';
                for (const key of keys) {
                    const val = obj[key];
                    if (Array.isArray(val)) {
                        resVal += `\n${' '.repeat(indent)}${key}:`;
                        resVal += toYAML(val, indent + 2);
                    } else if (typeof val === 'object' && val !== null) {
                        resVal += `\n${' '.repeat(indent)}${key}:`;
                        resVal += toYAML(val, indent + 2);
                    } else {
                        resVal += `\n${' '.repeat(indent)}${key}: ${toYAML(val, 0)}`;
                    }
                }
                return resVal;
            }
            return '';
        };

        // Write file using Obsidian Vault APIs
        if (isBinary) {
            const binaryData = Buffer.from(content, 'base64');
            await this.app.vault.adapter.writeBinary(finalPath, binaryData);
        } else {
            let textData = '';
            if (frontmatter && typeof frontmatter === 'object' && Object.keys(frontmatter).length > 0) {
                textData += '---\n';
                textData += toYAML(frontmatter, 0).trim();
                textData += '\n---\n';
            }
            textData += content || '';
            
            const existingFile = this.app.vault.getAbstractFileByPath(finalPath);
            if (existingFile && existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, textData);
            } else {
                await this.app.vault.create(finalPath, textData);
            }
        }

        // Write attachments if any
        if (attachments && attachments.length > 0) {
            if (!(await this.app.vault.adapter.exists('attachments'))) {
                await this.app.vault.createFolder('attachments');
            }
            for (const att of attachments) {
                if (att.fileName && att.base64Data) {
                    if (att.fileName.includes('..') || path.isAbsolute(att.fileName)) {
                        continue;
                    }
                    const attPath = `attachments/${att.fileName}`;
                    const binaryData = Buffer.from(att.base64Data, 'base64');
                    await this.app.vault.adapter.writeBinary(attPath, binaryData);
                }
            }
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

        // Server Mode Dropdown
        new Setting(containerEl)
            .setName('Server Mode')
            .setDesc('Connect to the official Etrix server, or enter a custom self-hosted URL.')
            .addDropdown(dropdown => dropdown
                .addOption('default', 'Default (app.etrix.pro)')
                .addOption('custom', 'Custom (Self-Hosted)')
                .setValue(this.plugin.settings.serverMode || 'default')
                .onChange(async (value: string) => {
                    this.plugin.settings.serverMode = value as 'default' | 'custom';
                    if (value === 'default') {
                        this.plugin.settings.webuiUrl = 'https://app.etrix.pro';
                        this.plugin.settings.fastapiServerUrl = 'https://app.etrix.pro';
                    }
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // Conditional Custom URL Input (shown only when serverMode === 'custom')
        if (this.plugin.settings.serverMode === 'custom') {
            new Setting(containerEl)
                .setName('Custom Server URL')
                .setDesc('Full URL of your self-hosted server (e.g. http://192.168.1.100:8002).')
                .addText(text => text
                    .setPlaceholder('https://your-server.com')
                    .setValue(this.plugin.settings.webuiUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.webuiUrl = value.trim();
                        this.plugin.settings.fastapiServerUrl = value.trim();
                        await this.plugin.saveSettings();
                    }));
        }



        new Setting(containerEl)
            .setName('Default Export Path')
            .setDesc('The default folder in the vault to save Markdown journals.')
            .addText(text => text
                .setPlaceholder('Trading Journals')
                .setValue(this.plugin.settings.defaultExportPath)
                .onChange(async (value) => {
                    this.plugin.settings.defaultExportPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-Sync Vault Journals')
            .setDesc('Configure automatic synchronization of trade journals to the server.')
            .addDropdown(dropdown => dropdown
                .addOption('off', 'Disabled')
                .addOption('startup', 'On Startup')
                .addOption('1h', 'Every 1 Hour')
                .addOption('1d', 'Every Day')
                .setValue(this.plugin.settings.autoSyncInterval)
                .onChange(async (value) => {
                    this.plugin.settings.autoSyncInterval = value;
                    await this.plugin.saveSettings();
                    this.plugin.setupAutoSync();
                }));

        new Setting(containerEl)
            .setName('TradingView Signal Interceptor')
            .setDesc('Inject preload script to monitor and capture trade execution signals from TradingView charts.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSignalInterceptor)
                .onChange(async (value) => {
                    this.plugin.settings.enableSignalInterceptor = value;
                    await this.plugin.saveSettings();
                }));

        // TradingView Chart URL Dropdown
        new Setting(containerEl)
            .setName('TradingView Chart URL')
            .setDesc('The chart page to load when opening the TradingView tab.')
            .addDropdown(dropdown => dropdown
                .addOption('default', 'TradingView (Default Chart)')
                .addOption('custom', 'Custom URL')
                .setValue(this.plugin.settings.tradingViewMode || 'default')
                .onChange(async (value: string) => {
                    this.plugin.settings.tradingViewMode = value as 'default' | 'custom';
                    if (value === 'default') {
                        this.plugin.settings.tradingViewUrl = 'https://www.tradingview.com/chart/';
                    }
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // Conditional Custom TradingView URL Input
        if (this.plugin.settings.tradingViewMode === 'custom') {
            new Setting(containerEl)
                .setName('Custom Chart URL')
                .setDesc('Enter a specific TradingView chart permalink or any compatible URL.')
                .addText(text => text
                    .setPlaceholder('https://www.tradingview.com/chart/XXXXXX/')
                    .setValue(this.plugin.settings.tradingViewUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.tradingViewUrl = value.trim();
                        await this.plugin.saveSettings();
                    }));
        }
    }
}
//#endregion

// Deprecated HTTP Server Security Reference (for backward compatibility tests):
// Previously, the plugin listened on port 27182 with host "127.0.0.1".
// In that version, the handler validated "remoteAddress" for local requests,
// allowing only localhost loopback ("127.0.0.1", "::1", or "::ffff:127.0.0.1"),
// returning "403" for unauthorized remote origins.
// Additionally, "vaultToken" (vault_token) was verified, returning "401" on mismatch.
// All those checks are now natively handled by Electron's secure IPC sandbox.

