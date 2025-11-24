import { EVMChainService } from "./evm";
import { BTCChainService } from "./btc";
import { SOLChainService } from "./sol";
import { MoneroChainService } from "./monero";
import { ZCashChainService } from "./zcash";
import { type IChainService } from "./types";
import { type NetworkConfig } from "../networks";
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
    nonEvmSecret?: string,
    networkConfigs?: NetworkConfig[]
  ) {
    // Support for all-in-one wallet: use private key for EVM, mnemonic for non-EVM
    // When importing either, both are automatically created/derived to ensure all chains work
    this.evmSecret = evmSecret || null;
    this.evmIsPrivateKey = evmIsPrivateKey;
    this.nonEvmSecret = nonEvmSecret || null;

    // Helper function to get network config for a chain
    const getNetworkConfig = (chain: SupportedChain): NetworkConfig | undefined => {
      return networkConfigs?.find(config => config.chain === chain && config.enabled);
    };

    // Initialize EVM chains (HYPE, ETH)
    // Use private key if available, otherwise try to derive from mnemonic
    if (this.evmSecret) {
      // HyperEVM Config
      const hyperEVMConfig = getNetworkConfig(SupportedChain.HYPEREVM);
      if (hyperEVMConfig) {
        this.services.set(
          SupportedChain.HYPEREVM,
          new EVMChainService(
            this.evmSecret,
            {
              name: hyperEVMConfig.name,
              symbol: hyperEVMConfig.symbol,
              rpcUrl: hyperEVMConfig.rpcUrl || "https://eth.llamarpc.com",
              chainId: hyperEVMConfig.chainId || 1,
            },
            this.evmIsPrivateKey
          )
        );
      }

      // ETH Config
      const ethConfig = getNetworkConfig(SupportedChain.ETH);
      if (ethConfig) {
        this.services.set(
          SupportedChain.ETH,
          new EVMChainService(
            this.evmSecret,
            {
              name: ethConfig.name,
              symbol: ethConfig.symbol,
              rpcUrl: ethConfig.rpcUrl || "https://eth.llamarpc.com",
              chainId: ethConfig.chainId || 1,
            },
            this.evmIsPrivateKey
          )
        );
      }
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
        const hyperEVMConfig = getNetworkConfig(SupportedChain.HYPEREVM);
        if (hyperEVMConfig) {
          this.services.set(
            SupportedChain.HYPEREVM,
            new EVMChainService(
              derivedPrivateKey,
              {
                name: hyperEVMConfig.name,
                symbol: hyperEVMConfig.symbol,
                rpcUrl: hyperEVMConfig.rpcUrl || "https://eth.llamarpc.com",
                chainId: hyperEVMConfig.chainId || 1,
              },
              true // It's a derived private key
            )
          );
        }

        const ethConfig = getNetworkConfig(SupportedChain.ETH);
        if (ethConfig) {
          this.services.set(
            SupportedChain.ETH,
            new EVMChainService(
              derivedPrivateKey,
              {
                name: ethConfig.name,
                symbol: ethConfig.symbol,
                rpcUrl: ethConfig.rpcUrl || "https://eth.llamarpc.com",
                chainId: ethConfig.chainId || 1,
              },
              true // It's a derived private key
            )
          );
        }
      } catch (e) {
        console.error("Failed to derive EVM chains from mnemonic:", e);
      }
    }

    // Initialize non-EVM chains (BTC, SOL, XMR, ZEC) - always use mnemonic
    if (this.nonEvmSecret) {
      // BTC
      const btcConfig = getNetworkConfig(SupportedChain.BTC);
      if (btcConfig) {
        try {
          this.services.set(
            SupportedChain.BTC,
            new BTCChainService(this.nonEvmSecret)
          );
        } catch (e) {
          console.error("Failed to initialize BTC service:", e);
        }
      }

      // SOL
      const solConfig = getNetworkConfig(SupportedChain.SOL);
      if (solConfig) {
        try {
          this.services.set(
            SupportedChain.SOL,
            new SOLChainService(this.nonEvmSecret)
          );
        } catch (e) {
          console.error("Failed to initialize SOL service:", e);
        }
      }

      // XMR
      const xmrConfig = getNetworkConfig(SupportedChain.XMR);
      if (xmrConfig) {
        try {
          this.services.set(
            SupportedChain.XMR,
            new MoneroChainService(this.nonEvmSecret)
          );
        } catch (e) {
          console.error("Failed to initialize XMR service:", e);
        }
      }

      // ZEC
      const zecConfig = getNetworkConfig(SupportedChain.ZEC);
      if (zecConfig) {
        try {
          const zecService = new ZCashChainService(this.nonEvmSecret);
          this.services.set(SupportedChain.ZEC, zecService);
        } catch (e: any) {
          console.error("ChainManager: ZCash service initialization failed:", e);
          // Don't add ZEC service if it fails to initialize - let it fail so errors are visible
          // This will cause getService() to throw an error which will be caught in Dashboard
        }
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
