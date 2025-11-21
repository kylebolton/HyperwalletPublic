import { type IChainService } from "./types";
// Dynamic import or require might be needed if build fails, but let's try static first.
// import moneroTs from "monero-ts";

export class MoneroChainService implements IChainService {
  chainName = "Monero";
  symbol = "XMR";
  private wallet: any;
  private mnemonic: string;

  constructor(mnemonic: string) {
    this.mnemonic = mnemonic;
  }

  async init() {
    if (this.wallet) return; // Already initialized
    if (this.wallet === null) return; // Already failed, don't retry

    // Dynamic import to avoid build issues if WASM config is tricky in prototype
    try {
      const moneroTs = await import("monero-ts");

      // Note: Syncing a Monero wallet from scratch (even light) can take time.
      // We use a remote node.
      // The monero-ts API may vary, so we try different initialization methods
      // Try multiple remote nodes for reliability
      const remoteNodes = [
        "http://node.xmr.to:18081", // Public Monero node
        "http://xmr-node.cakewallet.com:18081", // Cake Wallet public node
        "http://node.moneroworld.com:18089", // Fallback (may not always be available)
      ];

      let lastError: any = null;
      for (const serverUri of remoteNodes) {
        try {
          this.wallet = await moneroTs.createWalletFull({
            networkType: moneroTs.MoneroNetworkType.MAINNET,
            mnemonic: this.mnemonic,
            serverUri: serverUri,
          } as any);

          // If successful, break out of loop
          break;
        } catch (nodeError: any) {
          console.warn(`Monero node ${serverUri} failed:`, nodeError.message);
          lastError = nodeError;
          continue; // Try next node
        }
      }

      // If all nodes failed, set wallet to null
      if (!this.wallet) {
        console.error("All Monero remote nodes failed:", lastError);
        this.wallet = null;
        return;
      }

      // If we got here, wallet was successfully initialized
      // Don't await full sync in constructor or init, maybe trigger it in background
      if (this.wallet && typeof this.wallet.startSyncing === "function") {
        this.wallet.startSyncing();
      }
    } catch (e: any) {
      // Catch module resolution errors and other initialization failures
      const errorMessage = e.message || String(e);
      const isModuleError =
        errorMessage.includes("Cannot find module") ||
        errorMessage.includes("GenUtils") ||
        errorMessage.includes("module resolution");

      if (isModuleError) {
        console.warn(
          "Monero library is not compatible with this browser environment. Monero features will be disabled.",
          errorMessage
        );
      } else {
        console.error(
          "Monero library import or initialization failed:",
          errorMessage
        );
      }
      // Set wallet to null to indicate failure (don't throw)
      // This allows the service to gracefully degrade
      this.wallet = null;
    }
  }

  async getAddress(): Promise<string> {
    try {
      if (!this.wallet) await this.init();
      if (!this.wallet) return "Address Error";
      const address = await this.wallet.getPrimaryAddress();
      // Validate address format (non-blocking - warn but still return)
      if (!this.validateAddress(address)) {
        console.warn(`Monero address validation failed for: ${address}, but returning anyway`);
      }
      return address;
    } catch (e: any) {
      console.error("Failed to get Monero address:", e);
      return "Address Error";
    }
  }

  validateAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    
    // Monero mainnet addresses:
    // - Standard addresses: 95 characters, start with '4'
    // - Subaddresses: 95 characters, start with '8'
    // - Integrated addresses: 106 characters, start with '4'
    // All are base58 encoded
    
    const length = address.length;
    const firstChar = address[0];
    
    // Check for valid Monero address format
    if (length === 95 && (firstChar === '4' || firstChar === '8')) {
      // Basic format check - Monero addresses are base58
      // More thorough validation would require decoding and checksum verification
      return /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(address);
    }
    
    // Integrated addresses (106 chars)
    if (length === 106 && firstChar === '4') {
      return /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(address);
    }
    
    return false;
  }

  async getBalance(): Promise<string> {
    try {
      if (!this.wallet) {
        await this.init();
        if (!this.wallet) return "0.0";
      }
      const balance = await this.wallet.getBalance();
      // Convert from atomic units to XMR (1 XMR = 1e12 atomic units)
      return (balance / 1e12).toFixed(8);
    } catch (e: any) {
      console.error("Failed to get Monero balance:", e);
      return "0.0";
    }
  }

  async sendTransaction(_to: string, _amount: string): Promise<string> {
    throw new Error("Monero send not ready");
  }
}
