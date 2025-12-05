import { contextBridge, ipcRenderer } from "electron";
import path from "path";
import { pathToFileURL } from "url";
import { existsSync } from "fs";
import * as bip39 from "bip39";

// Load monero-ts in the Node/Electron context so we avoid bundling it into Vite.
// We then expose a minimal API to the renderer via contextBridge.
const moneroLib = require("monero-ts");

/**
 * Get the correct path to monero-ts dist directory
 * Handles both development and production (packaged) environments
 * Note: In preload scripts, we can't use `app` directly, so we detect packaged state differently
 */
function getMoneroDistDir(): string {
  // Detect if we're in a packaged app by checking if we're in an ASAR archive
  // or by checking if __dirname contains "app.asar"
  const isPackaged =
    __dirname.includes("app.asar") || process.resourcesPath !== undefined;

  let basePath: string;

  if (isPackaged) {
    // Production: app is packaged
    // Use process.resourcesPath if available (points to resources outside ASAR)
    // Otherwise, extract from __dirname (go up from app.asar to app directory)
    if (process.resourcesPath) {
      basePath = process.resourcesPath;
    } else {
      // Extract app path from __dirname (e.g., /path/to/app.asar/dist-electron -> /path/to/app)
      const asarIndex = __dirname.indexOf("app.asar");
      if (asarIndex !== -1) {
        basePath = __dirname.substring(0, asarIndex + "app.asar".length);
      } else {
        basePath = path.join(__dirname, "..", "..");
      }
    }
  } else {
    // Development: use __dirname (preload script location)
    // Go up from dist-electron to project root
    basePath = path.join(__dirname, "..");
  }

  // Try node_modules path first (works in both dev and production if node_modules is bundled)
  const nodeModulesPath = path.join(
    basePath,
    "node_modules",
    "monero-ts",
    "dist"
  );
  if (existsSync(nodeModulesPath)) {
    console.log(
      "[Preload][Monero] Found monero-ts in node_modules:",
      nodeModulesPath
    );
    return nodeModulesPath;
  }

  // Fallback: try relative to current working directory (development)
  const cwdPath = path.join(process.cwd(), "node_modules", "monero-ts", "dist");
  if (existsSync(cwdPath)) {
    console.log("[Preload][Monero] Found monero-ts in cwd:", cwdPath);
    return cwdPath;
  }

  // Last resort: use __dirname approach
  const fallbackPath = path.join(
    __dirname,
    "..",
    "node_modules",
    "monero-ts",
    "dist"
  );
  console.warn("[Preload][Monero] Using fallback path:", fallbackPath);
  return fallbackPath;
}

// Resolve worker from monero-ts dist directory
const MONERO_DIST_DIR = getMoneroDistDir();
const WORKER_PATH = path.join(MONERO_DIST_DIR, "monero.worker.js");
const WORKER_URL = pathToFileURL(WORKER_PATH).toString();

console.log("[Preload][Monero] Resolved paths:", {
  isPackaged: __dirname.includes("app.asar"),
  __dirname,
  moneroDistDir: MONERO_DIST_DIR,
  workerPath: WORKER_PATH,
  workerUrl: WORKER_URL,
  workerExists: existsSync(WORKER_PATH),
});

// Configure worker path and wasm resolution.
try {
  // Keep everything in-process to avoid WASM fetch over HTTP and worker MIME issues.
  moneroLib.MoneroUtils?.setProxyToWorker?.(false);
  moneroLib.LibraryUtils?.setWorkerDistPath(WORKER_URL);
  // Also set the default worker path global used inside the worker bootstrap.
  (globalThis as any).MONERO_WORKER_DIST_PATH = WORKER_URL;
} catch (e) {
  console.warn("[Preload][Monero] Failed to set worker path", e);
}

const locateFile = (p: string) =>
  pathToFileURL(path.join(MONERO_DIST_DIR, p.replace(/^\/+/, ""))).toString();

// Support both global shim and module-local locateFile consumers.
(globalThis as any).monero_javascript = {
  ...(globalThis as any).monero_javascript,
  locateFile,
};
(moneroLib as any).locateFile = locateFile;

type WalletInstance = any;
const walletCache = new Map<string, WalletInstance>();

const remoteNodes = [
  "https://node.monerodevs.org:443",
  "https://xmr-node.cakewallet.com:18081",
  "https://eu-node.cakewallet.com:18081",
];

/**
 * Get the private spend key from BIP39 mnemonic
 * We use the first 32 bytes of the BIP39 seed as the Monero private spend key
 * This is deterministic - the same BIP39 mnemonic will always produce the same Monero wallet
 */
function getMoneroPrivateSpendKey(bip39Mnemonic: string): Buffer {
  try {
    // Convert BIP39 mnemonic to seed (64 bytes)
    const bip39Seed = bip39.mnemonicToSeedSync(bip39Mnemonic);

    // Use first 32 bytes as the Monero private spend key
    const spendKeyBuffer = Buffer.from(bip39Seed).slice(0, 32);

    console.log("[Preload][Monero] Derived Monero private spend key from BIP39 mnemonic", {
      mnemonicLength: bip39Mnemonic.split(" ").length,
      spendKeyLength: spendKeyBuffer.length,
      spendKeyPrefix: spendKeyBuffer.toString("hex").substring(0, 8) + "...",
    });

    return spendKeyBuffer;
  } catch (e) {
    console.error("[Preload][Monero] Failed to derive spend key from mnemonic:", e);
    throw new Error(`Failed to derive Monero private spend key: ${e}`);
  }
}

async function ensureWallet(mnemonic: string): Promise<WalletInstance> {
  if (walletCache.has(mnemonic)) return walletCache.get(mnemonic)!;

  const networkType =
    moneroLib.MoneroNetworkType?.MAINNET ??
    moneroLib.MoneroNetworkType ??
    "mainnet";

  // Derive Monero private spend key from BIP39 mnemonic
  let privateSpendKey: Buffer;
  try {
    privateSpendKey = getMoneroPrivateSpendKey(mnemonic);
  } catch (e: any) {
    console.error("[Preload][Monero] Failed to derive private spend key:", e);
    throw new Error(
      `Failed to derive Monero private spend key: ${e?.message || String(e)}`
    );
  }

  // Use createWalletFromKeys - this accepts private keys directly, no mnemonic needed
  const MoneroWalletKeys = moneroLib.MoneroWalletKeys;
  const MoneroWalletConfig = moneroLib.MoneroWalletConfig;

  if (!MoneroWalletKeys || typeof MoneroWalletKeys.createWalletFromKeys !== "function") {
    throw new Error("MoneroWalletKeys.createWalletFromKeys is not available");
  }

  if (!MoneroWalletConfig) {
    throw new Error("MoneroWalletConfig is not available");
  }

  console.log("[Preload][Monero] Creating wallet from private keys...");
  try {
    const config = new MoneroWalletConfig();
    config.setPassword("hyperwallet");
    config.setNetworkType(networkType);

    // Set private spend key (as hex string for JSON serialization)
    const spendKeyHex = privateSpendKey.toString("hex");
    console.log("[Preload][Monero] Setting private spend key (64 hex chars)");
    config.setPrivateSpendKey(spendKeyHex);

    // View key will be derived automatically by the library from the spend key
    // We don't need to set it explicitly

    // Set proxyToWorker if available
    if (typeof config.setProxyToWorker === "function") {
      config.setProxyToWorker(false);
    }

    console.log("[Preload][Monero] Calling createWalletFromKeys...");
    const wallet = await MoneroWalletKeys.createWalletFromKeys(config);
    walletCache.set(mnemonic, wallet);
    console.log(
      "[Preload][Monero] Wallet created successfully using createWalletFromKeys"
    );
    return wallet;
  } catch (e: any) {
    console.error(
      "[Preload][Monero] createWalletFromKeys failed:",
      e?.message || String(e),
      e
    );
    throw new Error(
      `Failed to create Monero wallet from keys: ${e?.message || String(e)}`
    );
  }
}

async function getAddress(mnemonic: string): Promise<string> {
  try {
    const wallet = await ensureWallet(mnemonic);

    // For keys-only wallets, we should be able to get address immediately
    // For full wallets, we might need to wait for sync, but try anyway

    // Try multiple methods to get address (these are async methods)
    let address: string | undefined;
    let lastError: Error | undefined;

    // Method 1: getPrimaryAddress() - most common for keys-only wallets
    if (typeof wallet.getPrimaryAddress === "function") {
      try {
        const result = wallet.getPrimaryAddress();
        // Handle both sync and async returns
        address = result instanceof Promise ? await result : result;
        if (address && typeof address === "string" && address.length > 0) {
          console.log(
            "[Preload][Monero] Got address via getPrimaryAddress()",
            address.substring(0, 10) + "..."
          );
          return address;
        }
      } catch (e: any) {
        lastError = e;
        console.warn(
          "[Preload][Monero] getPrimaryAddress() failed:",
          e?.message || String(e)
        );
      }
    }

    // Method 2: getAddress() - some versions use this
    if (typeof wallet.getAddress === "function") {
      try {
        const result = wallet.getAddress();
        address = result instanceof Promise ? await result : result;
        if (address && typeof address === "string" && address.length > 0) {
          console.log(
            "[Preload][Monero] Got address via getAddress()",
            address.substring(0, 10) + "..."
          );
          return address;
        }
      } catch (e: any) {
        lastError = e;
        console.warn(
          "[Preload][Monero] getAddress() failed:",
          e?.message || String(e)
        );
      }
    }

    // Method 3: getAddress(0) or getAddress(0, 0) - with account/subaddress indices
    if (typeof wallet.getAddress === "function") {
      try {
        const result = wallet.getAddress(0);
        address = result instanceof Promise ? await result : result;
        if (address && typeof address === "string" && address.length > 0) {
          console.log(
            "[Preload][Monero] Got address via getAddress(0)",
            address.substring(0, 10) + "..."
          );
          return address;
        }
      } catch (e: any) {
        // Ignore - method might not accept parameters
      }
    }

    // Method 4: getSubaddress(0, 0) - for subaddresses
    if (typeof wallet.getSubaddress === "function") {
      try {
        const result = wallet.getSubaddress(0, 0);
        address = result instanceof Promise ? await result : result;
        if (address && typeof address === "string" && address.length > 0) {
          console.log(
            "[Preload][Monero] Got address via getSubaddress(0, 0)",
            address.substring(0, 10) + "..."
          );
          return address;
        }
      } catch (e: any) {
        lastError = e;
        console.warn(
          "[Preload][Monero] getSubaddress() failed:",
          e?.message || String(e)
        );
      }
    }

    // If all methods failed, throw error with details
    const errorMsg = lastError
      ? `Failed to get Monero address: ${
          lastError.message || String(lastError)
        }`
      : "Monero wallet has no working address retrieval method. All methods (getPrimaryAddress, getAddress, getSubaddress) failed or are unavailable.";
    console.error("[Preload][Monero]", errorMsg);
    throw new Error(errorMsg);
  } catch (e: any) {
    console.error("[Preload][Monero] getAddress error:", e);
    throw e;
  }
}

async function getBalance(mnemonic: string): Promise<string> {
  try {
    const wallet = await ensureWallet(mnemonic);
    if (typeof wallet.getBalance !== "function") return "0.0";
    const balanceAtomic = await wallet.getBalance();
    return (balanceAtomic / 1e12).toFixed(8);
  } catch (e) {
    console.warn("[Preload][Monero] getBalance failed, returning 0", e);
    return "0.0";
  }
}

async function resetWallet(mnemonic: string) {
  walletCache.delete(mnemonic);
}

const bridge = {
  initWallet: ensureWallet,
  getAddress,
  getBalance,
  resetWallet,
};

// Expose to renderer via contextBridge (required when contextIsolation is true)
// With contextIsolation: true, we can only use contextBridge, not direct window assignment
try {
  contextBridge.exposeInMainWorld("moneroBridge", bridge);
  console.log("[Preload][Monero] Bridge exposed via contextBridge");

  // Also expose Electron version info for environment detection
  contextBridge.exposeInMainWorld("electronAPI", {
    platform: process.platform,
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
    },
    // Auto-updater API
    updates: {
      checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
      downloadUpdate: () => ipcRenderer.invoke('download-update'),
      installUpdate: () => ipcRenderer.invoke('install-update'),
      getAppVersion: () => ipcRenderer.invoke('get-app-version'),
      onUpdateStatus: (callback: (status: any) => void) => {
        ipcRenderer.on('update-status', (_event, status) => {
          callback(status);
        });
      },
      removeUpdateStatusListener: () => {
        ipcRenderer.removeAllListeners('update-status');
      },
    },
  });
  console.log("[Preload] electronAPI exposed via contextBridge");
} catch (e) {
  // This should not happen with contextIsolation: true, but handle gracefully
  console.error(
    "[Preload][Monero] Failed to expose bridge via contextBridge:",
    e
  );
  // Note: With contextIsolation: true, we cannot set window.moneroBridge directly
  // If contextBridge fails, the bridge won't be available
  throw new Error("Failed to expose Monero bridge - contextBridge error");
}
