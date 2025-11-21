import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import Settings from './Settings';
import { NetworkService } from '../services/networks';
import { WalletService } from '../services/wallet';
import { StorageService } from '../services/storage';
import { SupportedChain } from '../services/chains/manager';

// Mock dependencies
vi.mock('../services/networks');
vi.mock('../services/wallet');
vi.mock('../services/storage');
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

describe('Settings Page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    
    // Default mocks
    (WalletService.getAllWallets as any) = vi.fn().mockReturnValue([]);
    (WalletService.getActiveWallet as any) = vi.fn().mockReturnValue(null);
    (StorageService.get as any) = vi.fn().mockReturnValue([]);
    (NetworkService.getNetworkConfigs as any) = vi.fn().mockReturnValue([
      {
        chain: SupportedChain.HYPEREVM,
        enabled: true,
        name: "HyperEVM",
        symbol: "HYPE",
        rpcUrl: "https://eth.llamarpc.com",
        chainId: 1,
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
    ]);
    (NetworkService.saveNetworkConfigs as any) = vi.fn();
    (NetworkService.toggleNetwork as any) = vi.fn();
    (NetworkService.updateNetworkConfig as any) = vi.fn();
  });

  const renderSettings = () => {
    return render(
      <HashRouter>
        <Settings />
      </HashRouter>
    );
  };

  describe('Tab Navigation', () => {
    it('should render all tabs', () => {
      renderSettings();
      
      expect(screen.getByText('Address Book')).toBeInTheDocument();
      expect(screen.getByText('Watch Wallets')).toBeInTheDocument();
      expect(screen.getByText('My Wallets')).toBeInTheDocument();
      expect(screen.getByText('Platform Configuration')).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
      renderSettings();
      
      const watchWalletsTab = screen.getByText('Watch Wallets');
      fireEvent.click(watchWalletsTab);
      
      expect(screen.getByText('Watch Wallets')).toBeInTheDocument();
    });
  });

  describe('Network Settings', () => {
    it('should display Network Settings section in Platform Configuration tab', () => {
      renderSettings();
      
      const platformConfigTab = screen.getByText('Platform Configuration');
      fireEvent.click(platformConfigTab);
      
      expect(screen.getByText('Network Settings')).toBeInTheDocument();
    });

    it('should display all networks with their information', () => {
      renderSettings();
      
      const platformConfigTab = screen.getByText('Platform Configuration');
      fireEvent.click(platformConfigTab);
      
      expect(screen.getByText('HyperEVM')).toBeInTheDocument();
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Bitcoin')).toBeInTheDocument();
    });

    it('should show RPC URL and Chain ID for EVM chains', async () => {
      renderSettings();
      
      const platformConfigTab = screen.getByText('Platform Configuration');
      fireEvent.click(platformConfigTab);
      
      await waitFor(() => {
        expect(screen.getByText(/RPC:/)).toBeInTheDocument();
        expect(screen.getByText(/Chain ID:/)).toBeInTheDocument();
      });
    });

    it('should toggle network enabled/disabled state', async () => {
      const mockConfigs = [
        {
          chain: SupportedChain.HYPEREVM,
          enabled: true,
          name: "HyperEVM",
          symbol: "HYPE",
          rpcUrl: "https://eth.llamarpc.com",
          chainId: 1,
          custom: false,
        },
      ];
      (NetworkService.getNetworkConfigs as any).mockReturnValue(mockConfigs);

      renderSettings();
      
      const platformConfigTab = screen.getByText('Platform Configuration');
      fireEvent.click(platformConfigTab);
      
      // Find toggle switch (checkbox input)
      const toggles = screen.getAllByRole('checkbox');
      const firstToggle = toggles[0];
      
      expect(firstToggle).toBeChecked(); // Initially enabled
      
      fireEvent.click(firstToggle);
      
      // State should update (component re-renders)
      await waitFor(() => {
        expect(firstToggle).not.toBeChecked();
      });
    });

    it('should open edit modal when edit button is clicked', () => {
      renderSettings();
      
      const platformConfigTab = screen.getByText('Platform Configuration');
      fireEvent.click(platformConfigTab);
      
      // Find edit buttons (for EVM chains)
      const editButtons = screen.getAllByTitle('Edit network');
      if (editButtons.length > 0) {
        fireEvent.click(editButtons[0]);
        
        // Modal should open with network name in title
        expect(screen.getByText(/Edit.*Network/)).toBeInTheDocument();
      }
    });

    it('should save network changes when Save button is clicked in edit modal', async () => {
      const mockSave = vi.fn();
      (NetworkService.saveNetworkConfigs as any) = mockSave;

      renderSettings();
      
      const platformConfigTab = screen.getByText('Platform Configuration');
      fireEvent.click(platformConfigTab);
      
      const editButtons = screen.getAllByTitle('Edit network');
      if (editButtons.length > 0) {
        fireEvent.click(editButtons[0]);
        
        // Wait for modal to appear
        await waitFor(() => {
          expect(screen.getByText(/Edit.*Network/)).toBeInTheDocument();
        });
        
        // Find and click Save button in modal
        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);
        
        // Modal should close
        await waitFor(() => {
          expect(screen.queryByText(/Edit.*Network/)).not.toBeInTheDocument();
        });
      }
    });

    it('should show Save Changes button', () => {
      renderSettings();
      
      const platformConfigTab = screen.getByText('Platform Configuration');
      fireEvent.click(platformConfigTab);
      
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('should save networks and show success message when Save Changes is clicked', async () => {
      const mockSave = vi.fn();
      (NetworkService.saveNetworkConfigs as any) = mockSave;
      
      // Mock window.location.reload
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
        configurable: true,
      });

      renderSettings();
      
      const platformConfigTab = screen.getByText('Platform Configuration');
      fireEvent.click(platformConfigTab);
      
      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        expect(saveButton).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
      });
    });

    it('should display custom indicator for custom networks', async () => {
      const mockConfigs = [
        {
          chain: SupportedChain.HYPEREVM,
          enabled: true,
          name: "Custom HyperEVM",
          symbol: "HYPE",
          rpcUrl: "https://custom.com",
          chainId: 999,
          custom: true,
        },
      ];
      (NetworkService.getNetworkConfigs as any).mockReturnValue(mockConfigs);

      renderSettings();
      
      const platformConfigTab = screen.getByText('Platform Configuration');
      fireEvent.click(platformConfigTab);
      
      await waitFor(() => {
        expect(screen.getByText('Custom')).toBeInTheDocument();
      });
    });
  });

  describe('Address Book Tab', () => {
    it('should display contacts list', async () => {
      const mockContacts = [
        { id: 1, name: 'Test Contact', address: '0x123' },
      ];
      (StorageService.get as any).mockImplementation((key: string) => {
        if (key === 'contacts') return mockContacts;
        return [];
      });

      renderSettings();
      
      await waitFor(() => {
        expect(screen.getByText('Test Contact')).toBeInTheDocument();
      });
    });

    it('should allow adding new contact', async () => {
      const mockPrompt = vi.spyOn(window, 'prompt');
      mockPrompt.mockReturnValueOnce('New Contact');
      mockPrompt.mockReturnValueOnce('0x456');

      renderSettings();
      
      await waitFor(() => {
        const addButton = screen.getByText('Add Contact');
        expect(addButton).toBeInTheDocument();
      });
      
      const addButton = screen.getByText('Add Contact');
      fireEvent.click(addButton);
      
      expect(mockPrompt).toHaveBeenCalled();
    });
  });

  describe('Watch Wallets Tab', () => {
    it('should display watch wallets list', async () => {
      const mockWallets = [
        { id: 1, name: 'Watch Wallet', address: '0x789', chain: 'ETH' },
      ];
      (StorageService.get as any).mockImplementation((key: string) => {
        if (key === 'watchWallets') return mockWallets;
        return [];
      });

      renderSettings();
      
      const watchWalletsTab = screen.getByText('Watch Wallets');
      fireEvent.click(watchWalletsTab);
      
      await waitFor(() => {
        expect(screen.getByText('Watch Wallet')).toBeInTheDocument();
      });
    });
  });
});

