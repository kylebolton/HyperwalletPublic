import { type IChainService } from "./types";
// Dynamic import or require might be needed if build fails, but let's try static first.
// import moneroTs from "monero-ts";

export class MoneroChainService implements IChainService {
  chainName = "Monero";
  symbol = "XMR";
  private wallet: any;
  private mnemonic: string;
  private initAttempts: number = 0;
  private maxInitAttempts: number = 3;
  private isInitializing: boolean = false;
  private lastInitError: Error | null = null;

  constructor(mnemonic: string) {
    this.mnemonic = mnemonic;
  }

  /**
   * Reset initialization state to allow retry
   * Useful if initialization failed but user wants to try again
   */
  resetInitState(): void {
    this.initAttempts = 0;
    this.lastInitError = null;
    this.isInitializing = false;
    // Don't reset wallet - if it exists, keep it
  }

  async init(): Promise<void> {
    console.log("[Monero] init() called", { 
      hasWallet: !!this.wallet, 
      isInitializing: this.isInitializing,
      initAttempts: this.initAttempts 
    });

    // If already initialized, return immediately
    if (this.wallet) {
      console.log("[Monero] Wallet already initialized, returning");
      return;
    }

    // If currently initializing, wait for it to complete
    if (this.isInitializing) {
      console.log("[Monero] Already initializing, waiting...");
      // Wait up to 60 seconds for initialization to complete
      const startTime = Date.now();
      while (this.isInitializing && Date.now() - startTime < 60000) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (this.wallet) {
          console.log("[Monero] Wallet initialized while waiting");
          return;
        }
      }
      if (!this.wallet) {
        throw new Error("Monero initialization timeout - wallet still initializing");
      }
      return;
    }

    // Reset failed state if we've exceeded max attempts but are retrying
    if (this.initAttempts >= this.maxInitAttempts) {
      // Allow retry after some time has passed (exponential backoff)
      const timeSinceLastAttempt = Date.now() - (this.lastInitError as any)?.timestamp || 0;
      if (timeSinceLastAttempt < 30000) {
        throw new Error(
          `Monero initialization failed after ${this.maxInitAttempts} attempts. Last error: ${this.lastInitError?.message || "Unknown"}. Please try again later.`
        );
      }
      // Reset for retry
      console.log("[Monero] Resetting init attempts for retry");
      this.initAttempts = 0;
      this.lastInitError = null;
    }

    this.isInitializing = true;
    this.initAttempts++;
    console.log(`[Monero] Starting initialization attempt ${this.initAttempts}/${this.maxInitAttempts}`);

    try {
      // Check if monero-ts is available
      let moneroTs: any;
      console.log("[Monero] Attempting to import monero-ts library...");
      try {
        moneroTs = await Promise.race([
          import("monero-ts"),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("monero-ts import timeout")), 10000)
          ),
        ]);
        
        // Verify the import actually worked and has expected exports
        if (!moneroTs || (typeof moneroTs !== "object" && typeof moneroTs !== "function")) {
          throw new Error("monero-ts import returned invalid value");
        }
        
        // Check for default export
        if (moneroTs.default) {
          moneroTs = moneroTs.default;
        }
        
        console.log("[Monero] monero-ts library imported successfully", {
          hasCreateWalletFull: typeof moneroTs?.createWalletFull === "function",
          hasCreateWalletKeys: typeof moneroTs?.createWalletKeys === "function",
          hasCreateWalletRpc: typeof moneroTs?.createWalletRpc === "function",
          hasMoneroNetworkType: !!moneroTs?.MoneroNetworkType,
          exports: Object.keys(moneroTs || {}).slice(0, 10),
        });
        
        // Verify at least one wallet creation method exists
        if (
          typeof moneroTs?.createWalletFull !== "function" &&
          typeof moneroTs?.createWalletKeys !== "function" &&
          typeof moneroTs?.createWalletRpc !== "function"
        ) {
          throw new Error("monero-ts library does not have expected wallet creation methods");
        }
      } catch (importError: any) {
        console.error("[Monero] Failed to import monero-ts:", importError);
        const errorMessage = importError.message || String(importError);
        const isModuleError =
          errorMessage.includes("Cannot find module") ||
          errorMessage.includes("GenUtils") ||
          errorMessage.includes("module resolution") ||
          errorMessage.includes("import timeout") ||
          errorMessage.includes("invalid value") ||
          errorMessage.includes("does not have expected");

        if (isModuleError) {
          const error = new Error(
            `Monero library (monero-ts) is not available in this browser environment. WebAssembly may not be supported or the library failed to load. Error: ${errorMessage}`
          );
          (error as any).timestamp = Date.now();
          this.lastInitError = error;
          this.isInitializing = false;
          throw error;
        }
        throw importError;
      }

      // Note: Syncing a Monero wallet from scratch (even light) can take time.
      // We use a remote node.
      // Try multiple remote nodes for reliability with increased timeouts
      const remoteNodes = [
        "http://node.xmr.to:18081", // Public Monero node
        "http://xmr-node.cakewallet.com:18081", // Cake Wallet public node
        "http://node.moneroworld.com:18089", // Fallback (may not always be available)
      ];

      let lastError: any = null;
      let walletCreated = false;

      // Try createWalletKeys first (works offline, no node needed for address)
      // This is better for browser environments and doesn't require network connection
      console.log("[Monero] Attempting to create wallet using createWalletKeys (offline mode)...");
      try {
        if (typeof moneroTs.createWalletKeys === "function") {
          console.log("[Monero] createWalletKeys method found, attempting to create wallet...");
          this.wallet = await Promise.race([
            moneroTs.createWalletKeys({
              networkType: moneroTs.MoneroNetworkType.MAINNET,
              mnemonic: this.mnemonic,
            } as any),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("createWalletKeys timeout")), 30000)
            ),
          ]);

          if (this.wallet) {
            console.log("[Monero] Wallet created successfully using createWalletKeys");
            console.log("[Monero] Wallet object from createWalletKeys:", {
              type: typeof this.wallet,
              hasGetPrimaryAddress: typeof this.wallet?.getPrimaryAddress === "function",
              hasGetAddress: typeof this.wallet?.getAddress === "function",
              hasGetBalance: typeof this.wallet?.getBalance === "function",
            });
            walletCreated = true;
          }
        } else {
          console.log("[Monero] createWalletKeys not available, trying createWalletFull");
        }
      } catch (keysError: any) {
        console.warn("[Monero] createWalletKeys failed:", keysError.message, keysError);
        lastError = keysError;
        // Don't give up - try createWalletFull as fallback
      }

      // If createWalletKeys failed, try createWalletFull with remote nodes
      if (!walletCreated) {
        console.log("[Monero] Attempting to create wallet using createWalletFull with remote nodes...");
        for (const serverUri of remoteNodes) {
          try {
            console.log(`[Monero] Attempting to connect to Monero node: ${serverUri}`);
            
            // Create wallet with timeout (60 seconds per node)
            this.wallet = await Promise.race([
              moneroTs.createWalletFull({
                networkType: moneroTs.MoneroNetworkType.MAINNET,
                mnemonic: this.mnemonic,
                serverUri: serverUri,
              } as any),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Node ${serverUri} connection timeout`)), 60000)
              ),
            ]);

            if (this.wallet) {
              console.log(`[Monero] Successfully connected to Monero node: ${serverUri}`);
              console.log("[Monero] Wallet object:", {
                type: typeof this.wallet,
                hasGetPrimaryAddress: typeof this.wallet?.getPrimaryAddress === "function",
                hasGetAddress: typeof this.wallet?.getAddress === "function",
                hasGetBalance: typeof this.wallet?.getBalance === "function",
                methods: Object.getOwnPropertyNames(Object.getPrototypeOf(this.wallet || {})),
              });
              walletCreated = true;
              break;
            }
          } catch (nodeError: any) {
            console.warn(`[Monero] Node ${serverUri} failed:`, nodeError.message, nodeError);
            lastError = nodeError;
            continue; // Try next node
          }
        }
      }

      // If all methods failed, throw error instead of silently setting to null
      if (!walletCreated || !this.wallet) {
        const error = new Error(
          `Failed to create Monero wallet. Tried createWalletKeys and createWalletFull with ${remoteNodes.length} nodes. Last error: ${lastError?.message || "Unknown error"}. Please check your internet connection and try again.`
        );
        (error as any).timestamp = Date.now();
        this.lastInitError = error;
        this.isInitializing = false;
        console.error("[Monero] Wallet creation failed:", error);
        throw error;
      }

      // Validate wallet object
      if (!this.wallet || typeof this.wallet !== "object") {
        const error = new Error("Monero wallet created but is invalid");
        (error as any).timestamp = Date.now();
        this.lastInitError = error;
        this.isInitializing = false;
        console.error("[Monero] Wallet validation failed:", error);
        throw error;
      }

      console.log("[Monero] Wallet created and validated successfully");

      // If we got here, wallet was successfully initialized
      // Start syncing in background (don't await) - only for full wallets
      try {
        if (this.wallet && typeof this.wallet.startSyncing === "function") {
          console.log("[Monero] Starting wallet sync...");
          this.wallet.startSyncing();
        } else if (this.wallet && typeof this.wallet.sync === "function") {
          // Some versions use sync() instead
          console.log("[Monero] Starting wallet sync (sync method)...");
          this.wallet.sync();
        } else {
          console.log("[Monero] No sync method available (this is OK for keys-only wallet)");
        }
      } catch (syncError: any) {
        // Non-critical - wallet is initialized, sync can happen later
        console.warn("[Monero] Wallet sync start failed (non-critical):", syncError.message);
      }

      // Reset error state on success
      this.initAttempts = 0;
      this.lastInitError = null;
      this.isInitializing = false;
      console.log("[Monero] Initialization completed successfully");
    } catch (e: any) {
      this.isInitializing = false;
      const error = e instanceof Error ? e : new Error(String(e));
      (error as any).timestamp = Date.now();
      this.lastInitError = error;
      
      console.error("[Monero] Initialization error caught:", {
        message: error.message,
        stack: error.stack,
        initAttempts: this.initAttempts,
        maxAttempts: this.maxInitAttempts,
      });
      
      // Don't set wallet to null - allow retry
      // Only throw if it's a critical error that won't be fixed by retry
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes("not available") ||
        errorMessage.includes("Cannot find module")
      ) {
        // These errors won't be fixed by retry
        console.error("[Monero] Critical error - cannot retry:", errorMessage);
        throw error;
      }
      
      // For other errors, throw to allow caller to handle retry
      console.error("[Monero] Non-critical error - can retry:", errorMessage);
      throw error;
    }
  }

  async getAddress(): Promise<string> {
    console.log("[Monero] getAddress() called", { hasWallet: !!this.wallet });
    try {
      // Ensure wallet is initialized
      if (!this.wallet) {
        console.log("[Monero] Wallet not initialized, calling init()...");
        try {
          await this.init();
          console.log("[Monero] init() completed", { hasWallet: !!this.wallet });
        } catch (initError: any) {
          console.error("[Monero] Initialization failed in getAddress:", initError);
          // Don't throw immediately - try to see if wallet was partially created
          // Some errors might occur after wallet creation
          if (!this.wallet) {
            // If wallet is still null, we can't proceed
            const errorMsg = initError.message || String(initError);
            if (errorMsg.includes("not available") || errorMsg.includes("Cannot find module")) {
              return `Address Error: Monero library is not available in this browser environment. Monero features require WebAssembly support.`;
            }
            throw new Error(`Monero wallet not initialized: ${initError.message}`);
          }
          // If wallet exists despite error, continue
          console.log("[Monero] Wallet exists despite init error, continuing...");
        }
      }

      if (!this.wallet) {
        console.error("[Monero] Wallet is null after initialization");
        throw new Error("Monero wallet is null after initialization");
      }

      console.log("[Monero] Wallet available, checking methods:", {
        hasGetPrimaryAddress: typeof this.wallet.getPrimaryAddress === "function",
        hasGetAddress: typeof this.wallet.getAddress === "function",
        hasGetSubaddress: typeof this.wallet.getSubaddress === "function",
        walletType: typeof this.wallet,
        walletKeys: Object.keys(this.wallet).slice(0, 10),
      });

      // Try to get address with timeout and multiple API methods
      let address: string | null = null;

      try {
        // Method 1: getPrimaryAddress() - most common
        if (typeof this.wallet.getPrimaryAddress === "function") {
          console.log("[Monero] Trying getPrimaryAddress()...");
          address = await Promise.race([
            this.wallet.getPrimaryAddress(),
            new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error("getPrimaryAddress timeout")), 15000)
            ),
          ]);
          console.log("[Monero] getPrimaryAddress() succeeded:", address?.substring(0, 20) + "...");
        } else {
          console.log("[Monero] getPrimaryAddress() method not available");
        }
      } catch (e1: any) {
        console.warn("[Monero] getPrimaryAddress() failed:", e1.message);
        
        // Method 2: getAddress() - some versions use this
        try {
          if (typeof this.wallet.getAddress === "function") {
            console.log("[Monero] Trying getAddress()...");
            address = await Promise.race([
              this.wallet.getAddress(),
              new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error("getAddress timeout")), 15000)
              ),
            ]);
            console.log("[Monero] getAddress() succeeded:", address?.substring(0, 20) + "...");
          }
        } catch (e2: any) {
          console.warn("[Monero] getAddress() failed:", e2.message);
          
          // Method 3: getAddress(0) - with account index
          try {
            if (typeof this.wallet.getAddress === "function") {
              console.log("[Monero] Trying getAddress(0)...");
              address = await Promise.race([
                this.wallet.getAddress(0),
                new Promise<string>((_, reject) =>
                  setTimeout(() => reject(new Error("getAddress(0) timeout")), 15000)
                ),
              ]);
              console.log("[Monero] getAddress(0) succeeded:", address?.substring(0, 20) + "...");
            }
          } catch (e3: any) {
            console.warn("[Monero] getAddress(0) failed:", e3.message);
            
            // Method 4: getSubaddress() - for subaddresses
            try {
              if (typeof this.wallet.getSubaddress === "function") {
                console.log("[Monero] Trying getSubaddress(0, 0)...");
                address = await Promise.race([
                  this.wallet.getSubaddress(0, 0),
                  new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("getSubaddress timeout")), 15000)
                  ),
                ]);
                console.log("[Monero] getSubaddress() succeeded:", address?.substring(0, 20) + "...");
              }
            } catch (e4: any) {
              console.error("[Monero] All address retrieval methods failed:", e4);
              throw new Error(
                `Failed to retrieve Monero address. Tried: getPrimaryAddress, getAddress, getAddress(0), getSubaddress. Last error: ${e4.message}`
              );
            }
          }
        }
      }

      if (!address) {
        console.error("[Monero] All methods returned null/undefined");
        throw new Error("All Monero address retrieval methods returned null or undefined");
      }

      console.log("[Monero] Address retrieved successfully:", address.substring(0, 20) + "...");

      // Validate address format (non-blocking - warn but still return)
      if (!this.validateAddress(address)) {
        console.warn(`[Monero] Address validation failed for: ${address}, but returning anyway`);
      } else {
        console.log("[Monero] Address validation passed");
      }

      return address;
    } catch (e: any) {
      console.error("Failed to get Monero address:", e);
      // Return detailed error message instead of generic "Address Error"
      const errorMessage = e.message || String(e);
      
      // Provide helpful error messages based on the failure type
      if (errorMessage.includes("not initialized") || errorMessage.includes("wallet is null")) {
        return `Address Error: Monero wallet not initialized. Please try again - this may take up to 90 seconds.`;
      }
      
      if (errorMessage.includes("not available") || errorMessage.includes("Cannot find module")) {
        return `Address Error: Monero library is not available in this environment. Monero features may not be supported.`;
      }
      
      if (errorMessage.includes("timeout") || errorMessage.includes("connection")) {
        return `Address Error: Monero node connection timeout. Please check your internet connection and try again.`;
      }
      
      if (errorMessage.includes("All Monero remote nodes failed")) {
        return `Address Error: Unable to connect to Monero network. Please check your internet connection and try again later.`;
      }
      
      // Generic error with suggestion
      return `Address Error: ${errorMessage}. Please try again or check your internet connection.`;
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
      // For keys-only wallets (createWalletKeys), balance requires a connection
      // Return 0.0 if wallet is not a full wallet or if balance retrieval fails
      if (!this.wallet) {
        console.log("[Monero] getBalance: Wallet not initialized, returning 0.0");
        return "0.0";
      }
      
      // Check if wallet has getBalance method
      if (typeof this.wallet.getBalance !== "function") {
        console.log("[Monero] getBalance: Wallet does not have getBalance method (keys-only wallet), returning 0.0");
        return "0.0";
      }
      
      try {
        const balance = await Promise.race([
          this.wallet.getBalance(),
          new Promise<number>((_, reject) =>
            setTimeout(() => reject(new Error("getBalance timeout")), 10000)
          ),
        ]);
        // Convert from atomic units to XMR (1 XMR = 1e12 atomic units)
        const balanceXMR = (balance / 1e12).toFixed(8);
        console.log("[Monero] getBalance: Retrieved balance:", balanceXMR);
        return balanceXMR;
      } catch (balanceError: any) {
        console.warn("[Monero] getBalance: Failed to retrieve balance (non-critical):", balanceError.message);
        // Return 0.0 instead of throwing - balance is not critical for display
        return "0.0";
      }
    } catch (e: any) {
      console.error("[Monero] getBalance: Error:", e);
      // Always return 0.0 instead of throwing - don't break the UI
      return "0.0";
    }
  }

  async sendTransaction(to: string, amount: string): Promise<string> {
    try {
      // Ensure wallet is initialized
      if (!this.wallet) {
        await this.init();
        if (!this.wallet) {
          throw new Error("Monero wallet not initialized");
        }
      }

      // Validate address
      if (!this.validateAddress(to)) {
        throw new Error("Invalid Monero address");
      }

      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Invalid amount");
      }

      // Get current balance to check sufficient funds
      const balance = await this.wallet.getBalance();
      const balanceXMR = balance / 1e12;
      if (amountNum > balanceXMR) {
        throw new Error("Insufficient balance");
      }

      // Convert amount to atomic units (1 XMR = 1e12 atomic units)
      const amountAtomic = BigInt(Math.floor(amountNum * 1e12));

      // Create transaction
      // monero-ts uses createTx method which returns a transaction
      // The API may vary, so we try the common patterns
      let tx: any;

      try {
        // Try the standard createTx method
        // This creates and sends the transaction
        tx = await this.wallet.createTx({
          accountIndex: 0,
          address: to,
          amount: amountAtomic.toString(),
          priority: 1, // Normal priority (0=default, 1=normal, 2=high)
        });
      } catch (createError: any) {
        // If createTx doesn't work, try alternative API
        try {
          // Some versions use different method names
          if (typeof this.wallet.createTransaction === "function") {
            tx = await this.wallet.createTransaction({
              accountIndex: 0,
              address: to,
              amount: amountAtomic.toString(),
            });
          } else if (typeof this.wallet.send === "function") {
            // Direct send method
            tx = await this.wallet.send({
              address: to,
              amount: amountAtomic.toString(),
            });
          } else {
            throw createError;
          }
        } catch (altError) {
          console.error("Monero transaction creation failed:", createError, altError);
          throw new Error(
            `Failed to create Monero transaction: ${createError.message || "Unknown error"}`
          );
        }
      }

      // Get transaction hash
      // The transaction object structure may vary
      let txHash: string;

      if (tx && tx.getHash) {
        txHash = await tx.getHash();
      } else if (tx && tx.hash) {
        txHash = tx.hash;
      } else if (tx && typeof tx === "string") {
        txHash = tx;
      } else if (tx && tx.txHash) {
        txHash = tx.txHash;
      } else {
        // If we can't get hash, try to get it from the transaction data
        // Some versions return the hash directly or in a different format
        throw new Error("Could not extract transaction hash from Monero transaction");
      }

      // Reload wallet to update balance after transaction
      try {
        if (typeof this.wallet.refresh === "function") {
          await this.wallet.refresh();
        } else if (typeof this.wallet.sync === "function") {
          await this.wallet.sync();
        }
      } catch (refreshError) {
        // Non-critical - balance will update on next sync
        console.warn("Failed to refresh wallet after transaction:", refreshError);
      }

      return txHash;
    } catch (e: any) {
      console.error("Monero sendTransaction error:", e);
      throw new Error(
        `Monero transaction failed: ${e.message || "Unknown error"}`
      );
    }
  }
}
