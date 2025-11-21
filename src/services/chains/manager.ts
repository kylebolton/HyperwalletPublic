import { EVMChainService } from "./evm";
import { BTCChainService } from "./btc";
import { SOLChainService } from "./sol";
import { MoneroChainService } from "./monero";
import { ZCashChainService } from "./zcash";
import { type IChainService } from "./types";
import { ethers } from "ethers";

export enum SupportedChain {
  HYPEREVM = "HYPEREVM",
  ETH = "ETH",
  BTC = "BTC",
  SOL = "SOL",
  XMR = "XMR",
  ZEC = "ZEC",
}

export class ChainManager {
  private services: Map<SupportedChain, IChainService> = new Map();
  private evmSecret: string | null = null;
  private evmIsPrivateKey: boolean = false;
  private nonEvmSecret: string | null = null;

  constructor(
    evmSecret?: string,
    evmIsPrivateKey: boolean = false,
    nonEvmSecret?: string
  ) {
    // Support for all-in-one wallet: use private key for EVM, mnemonic for non-EVM
    // When importing either, both are automatically created/derived to ensure all chains work
    this.evmSecret = evmSecret || null;
    this.evmIsPrivateKey = evmIsPrivateKey;
    this.nonEvmSecret = nonEvmSecret || null;

    // Initialize EVM chains (HYPE, ETH)
    // Use private key if available, otherwise try to derive from mnemonic
    if (this.evmSecret) {
      // HyperEVM Config - Hyperliquid EVM is Ethereum-compatible
      this.services.set(
        SupportedChain.HYPEREVM,
        new EVMChainService(
          this.evmSecret,
          {
            name: "HyperEVM",
            symbol: "HYPE",
            rpcUrl: "https://eth.llamarpc.com",
            chainId: 1,
          },
          this.evmIsPrivateKey
        )
      );

      // ETH - Using reliable public RPC endpoints
      this.services.set(
        SupportedChain.ETH,
        new EVMChainService(
          this.evmSecret,
          {
            name: "Ethereum",
            symbol: "ETH",
            rpcUrl: "https://eth.llamarpc.com",
            chainId: 1,
          },
          this.evmIsPrivateKey
        )
      );
    } else if (this.nonEvmSecret) {
      // If no EVM secret but we have mnemonic, derive EVM private key from mnemonic
      try {
        const hdNode = ethers.HDNodeWallet.fromPhrase(
          this.nonEvmSecret,
          undefined,
          "m/44'/60'/0'/0/0"
        );
        const derivedPrivateKey = hdNode.privateKey;

        // Initialize EVM chains with derived private key
        this.services.set(
          SupportedChain.HYPEREVM,
          new EVMChainService(
            derivedPrivateKey,
            {
              name: "HyperEVM",
              symbol: "HYPE",
              rpcUrl: "https://eth.llamarpc.com",
              chainId: 1,
            },
            true // It's a derived private key
          )
        );

        this.services.set(
          SupportedChain.ETH,
          new EVMChainService(
            derivedPrivateKey,
            {
              name: "Ethereum",
              symbol: "ETH",
              rpcUrl: "https://eth.llamarpc.com",
              chainId: 1,
            },
            true // It's a derived private key
          )
        );
      } catch (e) {
        console.error("Failed to derive EVM chains from mnemonic:", e);
      }
    }

    // Initialize non-EVM chains (BTC, SOL, XMR, ZEC) - always use mnemonic
    if (this.nonEvmSecret) {
      // BTC
      try {
        this.services.set(
          SupportedChain.BTC,
          new BTCChainService(this.nonEvmSecret)
        );
      } catch (e) {
        console.error("Failed to initialize BTC service:", e);
      }

      // SOL
      try {
        this.services.set(
          SupportedChain.SOL,
          new SOLChainService(this.nonEvmSecret)
        );
      } catch (e) {
        console.error("Failed to initialize SOL service:", e);
      }

      // XMR
      try {
        this.services.set(
          SupportedChain.XMR,
          new MoneroChainService(this.nonEvmSecret)
        );
      } catch (e) {
        console.error("Failed to initialize XMR service:", e);
      }

      // ZEC
      try {
        console.log("ChainManager: Initializing ZCash service...");
        const zecService = new ZCashChainService(this.nonEvmSecret);
        console.log("ChainManager: ZCash service initialized successfully");
        this.services.set(SupportedChain.ZEC, zecService);
      } catch (e: any) {
        console.error("ChainManager: ZCash service initialization failed:", e);
        console.error("ChainManager: ZCash error details:", e.message, e.stack);
        // Don't add ZEC service if it fails to initialize - let it fail so errors are visible
        // This will cause getService() to throw an error which will be caught in Dashboard
      }
    }
  }

  getService(chain: SupportedChain): IChainService {
    const service = this.services.get(chain);
    if (!service) {
      // Return a dummy service or throw specific error
      // Throwing error might break UI loops, so maybe return a "Disabled" service
      throw new Error(`Chain ${chain} not available with this key type`);
    }
    return service;
  }

  getAllServices(): IChainService[] {
    return Array.from(this.services.values());
  }
}
