export type ConnectionStatus = 'connecting' | 'connected' | 'error';

export interface ChainStatus {
  chain: string;
  status: ConnectionStatus;
  message?: string;
  timestamp: number;
}

export interface AggregateStatus {
  overall: ConnectionStatus;
  chains: ChainStatus[];
  message?: string;
}

type StatusChangeCallback = (status: AggregateStatus) => void;

export class ConnectionStatusService {
  private static chainStatuses: Map<string, ChainStatus> = new Map();
  private static subscribers: Set<StatusChangeCallback> = new Set();

  /**
   * Set connection status for a specific chain
   */
  static setChainStatus(
    chain: string,
    status: ConnectionStatus,
    message?: string
  ): void {
    const chainStatus: ChainStatus = {
      chain,
      status,
      message,
      timestamp: Date.now(),
    };

    this.chainStatuses.set(chain, chainStatus);
    this.notifySubscribers();
  }

  /**
   * Get status for a specific chain
   */
  static getChainStatus(chain: string): ChainStatus | null {
    return this.chainStatuses.get(chain) || null;
  }

  /**
   * Get aggregate status across all chains
   */
  static getStatus(): AggregateStatus {
    const chains = Array.from(this.chainStatuses.values());

    if (chains.length === 0) {
      return {
        overall: 'connecting',
        chains: [],
        message: 'Initializing...',
      };
    }

    // Determine overall status
    const hasError = chains.some(c => c.status === 'error');
    const hasConnecting = chains.some(c => c.status === 'connecting');
    const allConnected = chains.every(c => c.status === 'connected');

    let overall: ConnectionStatus;
    let message: string | undefined;

    if (hasError) {
      overall = 'error';
      const errorChains = chains.filter(c => c.status === 'error');
      if (errorChains.length === chains.length) {
        message = 'All chains failed to connect';
      } else {
        message = `${errorChains.length} chain(s) failed`;
      }
    } else if (hasConnecting) {
      overall = 'connecting';
      const connectingChains = chains.filter(c => c.status === 'connecting');
      message = `Connecting to ${connectingChains.length} chain(s)...`;
    } else if (allConnected) {
      overall = 'connected';
      message = `Connected to ${chains.length} chain(s)`;
    } else {
      overall = 'connecting';
      message = 'Connecting...';
    }

    return {
      overall,
      chains,
      message,
    };
  }

  /**
   * Subscribe to status changes
   */
  static subscribe(callback: StatusChangeCallback): () => void {
    this.subscribers.add(callback);
    
    // Immediately call with current status
    callback(this.getStatus());

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Clear all chain statuses (useful when switching wallets)
   */
  static clearAll(): void {
    this.chainStatuses.clear();
    this.notifySubscribers();
  }

  /**
   * Clear status for a specific chain
   */
  static clearChain(chain: string): void {
    this.chainStatuses.delete(chain);
    this.notifySubscribers();
  }

  private static notifySubscribers(): void {
    const status = this.getStatus();
    this.subscribers.forEach(callback => {
      try {
        callback(status);
      } catch (e) {
        console.error('[ConnectionStatus] Error in subscriber callback:', e);
      }
    });
  }
}

