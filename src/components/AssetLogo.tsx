import { motion } from "framer-motion";

interface AssetLogoProps {
  symbol: string;
  size?: number;
  className?: string;
}

const assetColors: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
  XMR: "#FF6600",
  ZEC: "#F4B728",
  HYPE: "#00FF9D",
  HYPEREVM: "#00FF9D",
  // Common HyperEVM tokens
  USDT: "#26a17b",
  USDC: "#2775ca",
  DAI: "#f5ac37",
  WBTC: "#f7931a",
  WETH: "#627eea",
  UNI: "#ff007a",
  LINK: "#2e5cea",
  AAVE: "#b6509e",
  wHYPE: "#00FF9D",
  WHYPE: "#00FF9D",
};

export default function AssetLogo({
  symbol,
  size = 48,
  className = "",
}: AssetLogoProps) {
  const color = assetColors[symbol.toUpperCase()] || "#000000";

  return (
    <motion.div
      className={`rounded-full flex items-center justify-center font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.4,
      }}
      whileHover={{ scale: 1.1 }}
      transition={{ duration: 0.2 }}
    >
      {symbol.substring(0, 2)}
    </motion.div>
  );
}

