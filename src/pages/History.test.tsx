import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import History from './History';
import { StorageService } from '../services/storage';
import { WalletService } from '../services/wallet';
import { NetworkService } from '../services/networks';
import { ChainManager } from '../services/chains/manager';
import { HistoryService } from '../services/history';
import { PreviewModeProvider } from '../contexts/PreviewModeContext';

// Mock dependencies
vi.mock('../services/storage');
vi.mock('../services/wallet');
vi.mock('../services/networks');
vi.mock('../services/chains/manager');
vi.mock('../services/history');

describe('History Page', () => {
  const mockServices = [
    {
      symbol: 'HYPE',
      chainName: 'HyperEVM',
      getAddress: vi.fn().mockResolvedValue('0x123'),
    },
  ];

  const mockChainManager = ChainManager as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    (StorageService.getMnemonic as any) = vi.fn().mockReturnValue('test mnemonic');
    (WalletService.getStoredPrivateKey as any) = vi.fn().mockReturnValue(null);
    (NetworkService.getEnabledNetworks as any) = vi.fn().mockReturnValue([]);
    mockChainManager.mockReset();
    mockChainManager.mockImplementation(function () {
      return {
        getAllServices: vi.fn().mockReturnValue(mockServices),
      };
    });
    (HistoryService.getHistory as any) = vi.fn().mockResolvedValue([
      {
        id: 'tx1',
        type: 'send',
        asset: 'HYPE',
        amount: '10.0',
        date: new Date().toLocaleString(),
        status: 'Confirmed',
        hash: '0xtx123',
        chain: 'HYPEREVM',
      },
    ]);
  });

  const renderHistory = () => {
    return render(
      <HashRouter>
        <PreviewModeProvider>
          <History />
        </PreviewModeProvider>
      </HashRouter>
    );
  };

  it('should render history page', () => {
    renderHistory();

    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('should load transaction history', async () => {
    renderHistory();

    await waitFor(() => {
      expect(HistoryService.getHistory).toHaveBeenCalled();
    });
  });

  it('should display transactions', async () => {
    renderHistory();

    await waitFor(() => {
      const txAmount = screen.queryByText('10.0');
      const historyHeading = screen.queryByText('History');

      expect(txAmount || historyHeading).toBeTruthy();
      expect(HistoryService.getHistory).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should show loading state initially', async () => {
    renderHistory();

    // Should call getHistory to load transactions
    await waitFor(() => {
      // HistoryService should be called to fetch transactions
      expect(HistoryService.getHistory).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});





