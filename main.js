"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  ChartView: () => ChartView,
  CockpitView: () => CockpitView,
  VIEW_TYPE_CHART: () => VIEW_TYPE_CHART,
  VIEW_TYPE_COCKPIT: () => VIEW_TYPE_COCKPIT,
  default: () => TraderCockpitPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var path = __toESM(require("path"));
var VIEW_TYPE_COCKPIT = "trader-cockpit-view";
var VIEW_TYPE_CHART = "trader-chart-view";
var DEFAULT_SETTINGS = {
  webuiUrl: "https://app.etrix.pro",
  tradingViewUrl: "https://www.tradingview.com/chart/",
  partition: "persist:trader-cockpit",
  webhookToken: "",
  fastapiServerUrl: "https://app.etrix.pro",
  jwtToken: "",
  defaultExportPath: "Trading Journals",
  autoSyncInterval: "off",
  enableSignalInterceptor: true,
  serverMode: "default",
  tradingViewMode: "default"
};
function configureSandboxedWebview(webview, src, partition, preloadUrl) {
  webview.className = "trader-cockpit-webview";
  webview.setAttribute("src", src);
  webview.setAttribute("partition", partition);
  webview.setAttribute("allowpopups", "");
  webview.setAttribute("nodeintegration", "false");
  webview.setAttribute("contextisolation", "true");
  webview.setAttribute("webpreferences", "contextIsolation=true, nodeIntegration=false");
  if (preloadUrl) {
    webview.setAttribute("preload", preloadUrl);
  }
}
var CockpitView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.webviewEl = null;
    this.plugin = plugin;
    this.addAction("refresh-cw", "Reload Page", () => {
      if (this.webviewEl) {
        this.webviewEl.reload();
      }
    });
  }
  getViewType() {
    return VIEW_TYPE_COCKPIT;
  }
  getDisplayText() {
    return "Trader Cockpit";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    if (!import_obsidian.Platform.isDesktop) {
      container.createEl("div", {
        text: "Trading Cockpit requires Obsidian Desktop (Electron) to load WebViews.",
        cls: "webview-error-message"
      });
      return;
    }
    const viewContainer = container.createEl("div", { cls: "trader-cockpit-container" });
    const webview = document.createElement("webview");
    configureSandboxedWebview(webview, this.plugin.settings.webuiUrl, this.plugin.settings.partition);
    const adapter = this.app.vault.adapter;
    if (adapter instanceof import_obsidian.FileSystemAdapter) {
      const pluginDir = `${this.app.vault.configDir}/plugins/obsidian-trader-cockpit`;
      const absolutePluginDir = adapter.getFullPath(pluginDir);
      const preloadFilePath = path.join(absolutePluginDir, "preload.js");
      const preloadUrl = "file://" + (process.platform === "win32" ? preloadFilePath.replace(/\\/g, "/") : preloadFilePath);
      webview.setAttribute("preload", preloadUrl);
    }
    webview.addEventListener("ipc-message", async (event) => {
      const { channel, args } = event;
      if (channel === "trade-execution") {
        this.plugin.handleTradeExecution(args[0]);
      } else if (channel === "telemetry-event") {
        this.plugin.handleTelemetry(args[0]);
      } else if (channel === "write-note") {
        try {
          const { file_path, content, overwrite, frontmatter, is_binary, attachments } = args[0];
          await this.plugin.writeNoteToVault(file_path, content, overwrite, frontmatter, is_binary, attachments);
          new import_obsidian.Notice(`Successfully saved note: ${file_path}`);
        } catch (err) {
          new import_obsidian.Notice(`Failed to save note: ${err.message}`);
        }
      } else if (channel === "open-chart-view") {
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
};
var ChartView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.webviewEl = null;
    this.plugin = plugin;
    this.addAction("refresh-cw", "Reload Page", () => {
      if (this.webviewEl) {
        this.webviewEl.reload();
      }
    });
  }
  getViewType() {
    return VIEW_TYPE_CHART;
  }
  getDisplayText() {
    return "Trader Chart";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    if (!import_obsidian.Platform.isDesktop) {
      container.createEl("div", {
        text: "Trading Chart requires Obsidian Desktop (Electron) to load WebViews.",
        cls: "webview-error-message"
      });
      return;
    }
    const viewContainer = container.createEl("div", { cls: "trader-cockpit-container" });
    const webview = document.createElement("webview");
    configureSandboxedWebview(webview, this.plugin.settings.tradingViewUrl, this.plugin.settings.partition);
    const adapter = this.app.vault.adapter;
    if (adapter instanceof import_obsidian.FileSystemAdapter && this.plugin.settings.enableSignalInterceptor) {
      const pluginDir = `${this.app.vault.configDir}/plugins/obsidian-trader-cockpit`;
      const absolutePluginDir = adapter.getFullPath(pluginDir);
      const preloadFilePath = path.join(absolutePluginDir, "preload.js");
      const preloadUrl = "file://" + (process.platform === "win32" ? preloadFilePath.replace(/\\/g, "/") : preloadFilePath);
      webview.setAttribute("preload", preloadUrl);
    }
    webview.addEventListener("ipc-message", async (event) => {
      const { channel, args } = event;
      if (channel === "trade-execution") {
        this.plugin.handleTradeExecution(args[0]);
      } else if (channel === "telemetry-event") {
        this.plugin.handleTelemetry(args[0]);
      } else if (channel === "write-note") {
        try {
          const { file_path, content, overwrite, frontmatter, is_binary, attachments } = args[0];
          await this.plugin.writeNoteToVault(file_path, content, overwrite, frontmatter, is_binary, attachments);
          new import_obsidian.Notice(`Successfully saved note: ${file_path}`);
        } catch (err) {
          new import_obsidian.Notice(`Failed to save note: ${err.message}`);
        }
      } else if (channel === "open-chart-view") {
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
};
var TraderCockpitPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.syncTimer = null;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(
      VIEW_TYPE_COCKPIT,
      (leaf) => new CockpitView(leaf, this)
    );
    this.registerView(
      VIEW_TYPE_CHART,
      (leaf) => new ChartView(leaf, this)
    );
    this.addRibbonIcon("gauge", "Open Trader Cockpit", () => {
      this.activateView(VIEW_TYPE_COCKPIT);
    });
    this.addRibbonIcon("trending-up", "Open TradingView Chart", () => {
      this.activateView(VIEW_TYPE_CHART);
    });
    this.addCommand({
      id: "open-trader-cockpit",
      name: "Open Trader Cockpit",
      callback: () => this.activateView(VIEW_TYPE_COCKPIT)
    });
    this.addCommand({
      id: "open-trader-chart",
      name: "Open TradingView Chart",
      callback: () => this.activateView(VIEW_TYPE_CHART)
    });
    this.addCommand({
      id: "sync-vault-journals",
      name: "Sync Vault Journals",
      callback: () => this.syncVaultJournals()
    });
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.autoSyncInterval === "startup") {
        this.syncVaultJournals();
      }
      this.setupAutoSync();
    });
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
    if (interval === "1h") {
      this.syncTimer = window.setInterval(() => this.syncVaultJournals(), 60 * 60 * 1e3);
    } else if (interval === "1d") {
      this.syncTimer = window.setInterval(() => this.syncVaultJournals(), 24 * 60 * 60 * 1e3);
    }
  }
  async writeNoteToVault(filePath, content, overwrite = true, frontmatter, isBinary, attachments) {
    if (filePath.includes("..") || path.isAbsolute(filePath)) {
      throw new Error("Invalid path: traversal or absolute paths not allowed");
    }
    let finalPath = filePath;
    const defaultPath = this.settings.defaultExportPath;
    if (defaultPath && !filePath.startsWith("/") && !filePath.startsWith(defaultPath)) {
      finalPath = path.join(defaultPath, filePath);
    }
    const existingFile = this.app.vault.getAbstractFileByPath(finalPath);
    if (existingFile && !overwrite) {
      throw new Error("File already exists");
    }
    const dirName = path.dirname(finalPath);
    if (dirName && dirName !== "." && dirName !== "/") {
      const parts = dirName.split(/[/\\]/);
      let currentPath = "";
      for (const part of parts) {
        if (!part)
          continue;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!await this.app.vault.adapter.exists(currentPath)) {
          await this.app.vault.createFolder(currentPath);
        }
      }
    }
    const toYAML = (obj, indent = 0) => {
      if (obj === null || obj === void 0) {
        return "null";
      }
      if (typeof obj === "string") {
        return `"${obj.replace(/"/g, '\\"')}"`;
      }
      if (typeof obj === "number" || typeof obj === "boolean") {
        return String(obj);
      }
      if (Array.isArray(obj)) {
        if (obj.length === 0)
          return " []";
        let resVal = "";
        for (const item of obj) {
          if (typeof item === "object" && item !== null) {
            const keys = Object.keys(item);
            if (keys.length === 0) {
              resVal += `
${" ".repeat(indent)}- {}`;
              continue;
            }
            const firstKey = keys[0];
            const firstVal = item[firstKey];
            resVal += `
${" ".repeat(indent)}- ${firstKey}: ${toYAML(firstVal, 0)}`;
            for (let i = 1; i < keys.length; i++) {
              const k = keys[i];
              const v = item[k];
              if (typeof v === "object" && v !== null) {
                resVal += `
${" ".repeat(indent + 2)}${k}:${toYAML(v, indent + 4)}`;
              } else {
                resVal += `
${" ".repeat(indent + 2)}${k}: ${toYAML(v, 0)}`;
              }
            }
          } else {
            resVal += `
${" ".repeat(indent)}- ${toYAML(item, 0)}`;
          }
        }
        return resVal;
      }
      if (typeof obj === "object") {
        const keys = Object.keys(obj);
        if (keys.length === 0)
          return " {}";
        let resVal = "";
        for (const key of keys) {
          const val = obj[key];
          if (Array.isArray(val)) {
            resVal += `
${" ".repeat(indent)}${key}:`;
            resVal += toYAML(val, indent + 2);
          } else if (typeof val === "object" && val !== null) {
            resVal += `
${" ".repeat(indent)}${key}:`;
            resVal += toYAML(val, indent + 2);
          } else {
            resVal += `
${" ".repeat(indent)}${key}: ${toYAML(val, 0)}`;
          }
        }
        return resVal;
      }
      return "";
    };
    if (isBinary) {
      const binaryData = Buffer.from(content, "base64");
      await this.app.vault.adapter.writeBinary(finalPath, binaryData);
    } else {
      let textData = "";
      if (frontmatter && typeof frontmatter === "object" && Object.keys(frontmatter).length > 0) {
        textData += "---\n";
        textData += toYAML(frontmatter, 0).trim();
        textData += "\n---\n";
      }
      textData += content || "";
      const existingFile2 = this.app.vault.getAbstractFileByPath(finalPath);
      if (existingFile2 && existingFile2 instanceof import_obsidian.TFile) {
        await this.app.vault.modify(existingFile2, textData);
      } else {
        await this.app.vault.create(finalPath, textData);
      }
    }
    if (attachments && attachments.length > 0) {
      if (!await this.app.vault.adapter.exists("attachments")) {
        await this.app.vault.createFolder("attachments");
      }
      for (const att of attachments) {
        if (att.fileName && att.base64Data) {
          if (att.fileName.includes("..") || path.isAbsolute(att.fileName)) {
            continue;
          }
          const attPath = `attachments/${att.fileName}`;
          const binaryData = Buffer.from(att.base64Data, "base64");
          await this.app.vault.adapter.writeBinary(attPath, binaryData);
        }
      }
    }
  }
  getJwtToken() {
    return this.settings.jwtToken || "";
  }
  async syncVaultJournals() {
    const files = this.app.vault.getMarkdownFiles();
    const syncPayload = [];
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache && cache.frontmatter) {
        const fm = cache.frontmatter;
        if (fm.symbol && fm.action && fm.price && fm.size && fm.status) {
          let parsedDate = "";
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
            notes: fm.notes || ""
          });
        }
      }
    }
    if (syncPayload.length === 0) {
      new import_obsidian.Notice("No journals with valid trading frontmatter found to sync.");
      return;
    }
    const url = `${this.settings.fastapiServerUrl}/api/journal/sync`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.getJwtToken()}`
        },
        body: JSON.stringify({ logs: syncPayload })
      });
      if (response.ok) {
        new import_obsidian.Notice(`Successfully synced ${syncPayload.length} journals to database.`);
      } else {
        const errText = await response.text();
        new import_obsidian.Notice(`Failed to synchronize journals: ${response.status} - ${errText}`);
      }
    } catch (e) {
      console.error("[Trader Cockpit] Journal sync failed:", e);
      new import_obsidian.Notice(`Failed to synchronize journals: ${e.message}`);
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async activateView(viewType) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(viewType)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: viewType, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  handleTradeExecution(payload) {
    console.log("[Host] Trade payload received:", payload);
    const symbol = payload.symbol || payload.ticker || "Unknown Ticker";
    const direction = payload.direction || payload.action || payload.side || "Unknown Direction";
    const lots = payload.lots || payload.qty || payload.quantity || payload.volume || "0";
    new import_obsidian.Notice(`Trade Captured:
Symbol: ${symbol}
Lots: ${lots}
Direction: ${direction}`);
  }
  handleTelemetry(data) {
    console.log("[Host Cockpit View] Telemetry event received:", data);
  }
};
var TraderCockpitSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Trader Cockpit Settings" });
    new import_obsidian.Setting(containerEl).setName("Server Mode").setDesc("Connect to the official Etrix server, or enter a custom self-hosted URL.").addDropdown((dropdown) => dropdown.addOption("default", "Default (app.etrix.pro)").addOption("custom", "Custom (Self-Hosted)").setValue(this.plugin.settings.serverMode || "default").onChange(async (value) => {
      this.plugin.settings.serverMode = value;
      if (value === "default") {
        this.plugin.settings.webuiUrl = "https://app.etrix.pro";
        this.plugin.settings.fastapiServerUrl = "https://app.etrix.pro";
      }
      await this.plugin.saveSettings();
      this.display();
    }));
    if (this.plugin.settings.serverMode === "custom") {
      new import_obsidian.Setting(containerEl).setName("Custom Server URL").setDesc("Full URL of your self-hosted server (e.g. http://192.168.1.100:8002).").addText((text) => text.setPlaceholder("https://your-server.com").setValue(this.plugin.settings.webuiUrl).onChange(async (value) => {
        this.plugin.settings.webuiUrl = value.trim();
        this.plugin.settings.fastapiServerUrl = value.trim();
        await this.plugin.saveSettings();
      }));
    }
    new import_obsidian.Setting(containerEl).setName("Default Export Path").setDesc("The default folder in the vault to save Markdown journals.").addText((text) => text.setPlaceholder("Trading Journals").setValue(this.plugin.settings.defaultExportPath).onChange(async (value) => {
      this.plugin.settings.defaultExportPath = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Auto-Sync Vault Journals").setDesc("Configure automatic synchronization of trade journals to the server.").addDropdown((dropdown) => dropdown.addOption("off", "Disabled").addOption("startup", "On Startup").addOption("1h", "Every 1 Hour").addOption("1d", "Every Day").setValue(this.plugin.settings.autoSyncInterval).onChange(async (value) => {
      this.plugin.settings.autoSyncInterval = value;
      await this.plugin.saveSettings();
      this.plugin.setupAutoSync();
    }));
    new import_obsidian.Setting(containerEl).setName("TradingView Signal Interceptor").setDesc("Inject preload script to monitor and capture trade execution signals from TradingView charts.").addToggle((toggle) => toggle.setValue(this.plugin.settings.enableSignalInterceptor).onChange(async (value) => {
      this.plugin.settings.enableSignalInterceptor = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("TradingView Chart URL").setDesc("The chart page to load when opening the TradingView tab.").addDropdown((dropdown) => dropdown.addOption("default", "TradingView (Default Chart)").addOption("custom", "Custom URL").setValue(this.plugin.settings.tradingViewMode || "default").onChange(async (value) => {
      this.plugin.settings.tradingViewMode = value;
      if (value === "default") {
        this.plugin.settings.tradingViewUrl = "https://www.tradingview.com/chart/";
      }
      await this.plugin.saveSettings();
      this.display();
    }));
    if (this.plugin.settings.tradingViewMode === "custom") {
      new import_obsidian.Setting(containerEl).setName("Custom Chart URL").setDesc("Enter a specific TradingView chart permalink or any compatible URL.").addText((text) => text.setPlaceholder("https://www.tradingview.com/chart/XXXXXX/").setValue(this.plugin.settings.tradingViewUrl).onChange(async (value) => {
        this.plugin.settings.tradingViewUrl = value.trim();
        await this.plugin.saveSettings();
      }));
    }
  }
};
