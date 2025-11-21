import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";
import Modal from "./Modal";

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  symbol: string;
}

export default function ReceiveModal({
  isOpen,
  onClose,
  address,
  symbol,
}: ReceiveModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isValidAddress =
    address &&
    address !== "Loading..." &&
    address !== "Address Error" &&
    address !== "No wallet" &&
    address !== "No credentials";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Receive ${symbol}`}>
      <div className="flex flex-col items-center space-y-6">
        {isValidAddress ? (
          <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] transition-colors">
            <QRCodeSVG value={address} size={200} />
          </div>
        ) : (
          <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] w-[200px] h-[200px] flex items-center justify-center transition-colors">
            <p className="text-sm text-[var(--text-secondary)] text-center">
              Loading QR code...
            </p>
          </div>
        )}

        <div className="w-full text-center space-y-2">
          <p className="text-sm text-[var(--text-secondary)] font-medium">Your Address</p>
          {address &&
          address !== "Loading..." &&
          address !== "Address Error" &&
          address !== "No wallet" &&
          address !== "No credentials" ? (
            <div
              onClick={handleCopy}
              className="group cursor-pointer p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] hover:border-hyper-green transition-colors relative break-all"
            >
              <p className="text-sm font-mono text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                {address}
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
              <p className="text-sm font-mono text-[var(--text-secondary)]">
                {address === "Loading..."
                  ? "Loading address..."
                  : address || "Loading address..."}
              </p>
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
