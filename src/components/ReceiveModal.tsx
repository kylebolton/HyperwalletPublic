import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, RefreshCw } from "lucide-react";
import Modal from "./Modal";

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  symbol: string;
  onGenerateNewAddress?: () => Promise<string>;
}

export default function ReceiveModal({
  isOpen,
  onClose,
  address,
  symbol,
  onGenerateNewAddress,
}: ReceiveModalProps) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAddress, setCurrentAddress] = useState(address);

  // Update current address when prop changes
  useEffect(() => {
    setCurrentAddress(address);
  }, [address]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateNewAddress = async () => {
    if (!onGenerateNewAddress) return;
    
    setIsGenerating(true);
    try {
      const newAddress = await onGenerateNewAddress();
      setCurrentAddress(newAddress);
    } catch (error) {
      console.error("Failed to generate new address:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const isValidAddress =
    currentAddress &&
    currentAddress !== "Loading..." &&
    currentAddress !== "Address Error" &&
    currentAddress !== "No wallet" &&
    currentAddress !== "No credentials" &&
    !currentAddress.includes("Initializing") &&
    !currentAddress.includes("Getting address") &&
    !currentAddress.includes("Retrying");

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Receive ${symbol}`}>
      <div className="flex flex-col items-center space-y-6 pb-2">
        {isValidAddress ? (
          <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] transition-colors">
            <QRCodeSVG value={currentAddress} size={200} />
          </div>
        ) : (
          <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] w-[200px] h-[200px] flex flex-col items-center justify-center transition-colors">
            <div className="w-8 h-8 border-4 border-hyper-green border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm text-[var(--text-secondary)] text-center">
              {currentAddress && currentAddress.includes("Initializing") 
                ? currentAddress 
                : currentAddress && currentAddress.includes("Getting address")
                ? currentAddress
                : "Loading QR code..."}
            </p>
          </div>
        )}

        <div className="w-full text-center space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--text-secondary)] font-medium">Your Address</p>
            {onGenerateNewAddress && isValidAddress && (
              <button
                onClick={handleGenerateNewAddress}
                disabled={isGenerating}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-hyper-green hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} />
                {isGenerating ? "Generating..." : "New Address"}
              </button>
            )}
          </div>
          {currentAddress &&
          currentAddress !== "Loading..." &&
          currentAddress !== "Address Error" &&
          currentAddress !== "No wallet" &&
          currentAddress !== "No credentials" ? (
            <div
              onClick={handleCopy}
              className="group cursor-pointer p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] hover:border-hyper-green transition-colors relative break-all"
            >
              <p className="text-sm font-mono text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                {currentAddress}
              </p>
              <div className="absolute top-2 right-2">
                {copied ? (
                  <Check size={14} className="text-hyper-green" />
                ) : (
                  <Copy size={14} className="text-[var(--text-tertiary)]" />
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] transition-colors">
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-hyper-green border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-mono text-[var(--text-secondary)]">
                  {currentAddress && (currentAddress.includes("Initializing") || currentAddress.includes("Getting address") || currentAddress.includes("Retrying"))
                    ? currentAddress
                    : currentAddress === "Loading..."
                    ? "Loading address..."
                    : currentAddress || "Loading address..."}
                </p>
              </div>
            </div>
          )}
        </div>

        {isValidAddress && (
          <p className="text-xs text-center text-[var(--text-secondary)]">
            Only send <span className="font-bold text-[var(--text-primary)]">{symbol}</span> to
            this address.
          </p>
        )}
      </div>
    </Modal>
  );
}
