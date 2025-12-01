import { SupportedChain } from "./chains/manager";
import { StorageService, STORAGE_KEYS } from "./storage";

export interface NetworkConfig {
  chain: SupportedChain;
  enabled: boolean;
  name: string;
  symbol: string;
  rpcUrl?: string; // For EVM chains
  chainId?: number; // For EVM chains
  custom: boolean;
}

// Lazy initialization to avoid circular dependency issues
function getDefaultNetworks(): NetworkConfig[] {
  return [
    {
      chain: SupportedChain.HYPEREVM,
      enabled: true,
      name: "HyperEVM",
      symbol: "HYPE",
      rpcUrl: "https://rpc.hyperliquid.xyz/evm",
      chainId: 999,
      custom: false,
    },
    {
      chain: SupportedChain.ETH,
      enabled: true,
      name: "Ethereum",
      symbol: "ETH",
      rpcUrl: "https://eth.llamarpc.com",
      chainId: 1,
      custom: false,
    },
    {
      chain: SupportedChain.BTC,
      enabled: true,
      name: "Bitcoin",
      symbol: "BTC",
      custom: false,
    },
    {
      chain: SupportedChain.SOL,
      enabled: true,
      name: "Solana",
      symbol: "SOL",
      custom: false,
    },
    {
      chain: SupportedChain.XMR,
      enabled: true,
      name: "Monero",
      symbol: "XMR",
      custom: false,
    },
    {
      chain: SupportedChain.ZEC,
      enabled: true,
      name: "ZCash",
      symbol: "ZEC",
      custom: false,
    },
  ];
}

export class NetworkService {
  /**
   * Get all network configurations from storage or return defaults
   */
  static getNetworkConfigs(): NetworkConfig[] {
    const DEFAULT_NETWORKS = getDefaultNetworks();
    const stored = StorageService.get(STORAGE_KEYS.NETWORKS);
    if (stored && Array.isArray(stored)) {
      // Merge stored configs with defaults to ensure all chains are present
      const storedMap = new Map(
        stored.map((config: NetworkConfig) => [config.chain, config])
      );
      return DEFAULT_NETWORKS.map(defaultConfig => {
        const storedConfig = storedMap.get(defaultConfig.chain);
        if (storedConfig) {
          // Preserve custom settings but ensure all required fields exist
          return {
            ...defaultConfig,
            ...storedConfig,
            chain: defaultConfig.chain, // Ensure chain is correct
          };
        }
        return defaultConfig;
      });
    }
    return [...DEFAULT_NETWORKS];
  }

  /**
   * Save network configurations to storage
   */
  static saveNetworkConfigs(configs: NetworkConfig[]): void {
    StorageService.save(STORAGE_KEYS.NETWORKS, configs);
  }

  /**
   * Get only enabled network configurations
   */
  static getEnabledNetworks(): NetworkConfig[] {
    return this.getNetworkConfigs().filter(config => config.enabled);
  }

  /**
   * Update a specific network configuration
   */
  static updateNetworkConfig(
    chain: SupportedChain,
    updates: Partial<NetworkConfig>
  ): void {
    const configs = this.getNetworkConfigs();
    const index = configs.findIndex(config => config.chain === chain);
    if (index >= 0) {
      configs[index] = { ...configs[index], ...updates };
      this.saveNetworkConfigs(configs);
    }
  }

  /**
   * Toggle network enabled/disabled state
   */
  static toggleNetwork(chain: SupportedChain, enabled: boolean): void {
    this.updateNetworkConfig(chain, { enabled });
  }

  /**
   * Get a specific network configuration
   */
  static getNetworkConfig(chain: SupportedChain): NetworkConfig | undefined {
    return this.getNetworkConfigs().find(config => config.chain === chain);
  }

  /**
   * Reset all networks to defaults
   */
  static resetToDefaults(): void {
    StorageService.save(STORAGE_KEYS.NETWORKS, getDefaultNetworks());
  }
}

