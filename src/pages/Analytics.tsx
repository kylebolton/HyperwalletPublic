import { useEffect, useState } from "react";
import { MarketService, type MarketData } from "../services/market";
import { ChainManager } from "../services/chains/manager";
import { NetworkService } from "../services/networks";
import { StorageService } from "../services/storage";
import { WalletService } from "../services/wallet";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";

export default function Analytics() {
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [portfolio, setPortfolio] = useState<
    { name: string; value: number; symbol: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const mnemonic = StorageService.getMnemonic();
        const privKey = WalletService.getStoredPrivateKey();

        // Support all-in-one wallet: use private key for EVM, mnemonic for non-EVM
        if (!mnemonic && !privKey) {
          if (isMounted) setLoading(false);
          return;
        }

        const enabledNetworks = NetworkService.getEnabledNetworks();
        const manager = new ChainManager(
          privKey || undefined, // EVM secret (prefer private key)
          !!privKey, // Is private key
          mnemonic || undefined, // Non-EVM secret (mnemonic)
          enabledNetworks // Network configurations
        );
        const services = manager.getAllServices();

        const symbols = services.map(s => s.symbol);
        
        // Add timeout for market data fetching
        const pricesPromise = MarketService.getPrices(symbols);
        const prices = await Promise.race([
          pricesPromise,
          new Promise<Record<string, any>>((_, reject) =>
            setTimeout(() => reject(new Error("Market data timeout")), 10000)
          ),
        ]).catch(() => {
          // Return empty prices on timeout
          return {} as Record<string, any>;
        });

        if (!isMounted) return;
        setMarketData(prices);

        const newPortfolio = [];
        for (const service of services) {
          try {
            const balStr = await service.getBalance();
            const bal = parseFloat(balStr);
            const price = prices[service.symbol]?.current_price || 0;
            if (bal > 0 && price > 0) {
              newPortfolio.push({
                name: service.chainName,
                symbol: service.symbol,
                value: bal * price,
              });
            }
          } catch (e) {
            console.error(`Failed to load balance for ${service.symbol}:`, e);
          }
        }

        if (!isMounted) return;
        setPortfolio(newPortfolio);
        setLoading(false);
      } catch (e) {
        console.error("Failed to load analytics data:", e);
        if (isMounted) {
          setLoading(false);
          setPortfolio([]);
          setMarketData({});
        }
      }
    };
    
    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const COLORS = ["#00FF9D", "#00C278", "#008552", "#00472C", "#002919"];

  // Mock historical data for visualization since we can't fetch full history easily
  const mockHistoryData = [
    { name: "Mon", val: 4000 },
    { name: "Tue", val: 3000 },
    { name: "Wed", val: 2000 },
    { name: "Thu", val: 2780 },
    { name: "Fri", val: 1890 },
    { name: "Sat", val: 2390 },
    { name: "Sun", val: 3490 },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold tracking-tighter">Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Allocation Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-primary)] transition-colors"
        >
          <h2 className="text-xl font-bold mb-6">Asset Allocation</h2>
          {loading ? (
            <div className="h-64 bg-[var(--bg-tertiary)] rounded-xl animate-pulse transition-colors"></div>
          ) : portfolio.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={portfolio}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {portfolio.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [
                      `$${value.toFixed(2)}`,
                      "Value",
                    ]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      backgroundColor: "var(--bg-primary)",
                      color: "var(--text-primary)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]">
              No assets found to display
            </div>
          )}
        </motion.div>

        {/* Market Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-primary)] transition-colors"
        >
          <h2 className="text-xl font-bold mb-6">Market Trends (7d)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockHistoryData}>
                <XAxis
                  dataKey="name"
                  stroke="var(--border-primary)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--border-primary)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `$${val}`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="val"
                  stroke="#00FF9D"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Price List */}
      <div className="p-6 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-primary)] shadow-sm transition-colors">
        <h2 className="text-xl font-bold mb-4">Live Market Prices</h2>
        <div className="space-y-4">
          {Object.entries(marketData).map(([symbol, data]) => (
            <div
              key={symbol}
              className="flex items-center justify-between p-3 hover:bg-[var(--hover-bg)] rounded-xl transition-colors"
            >
              <div className="font-bold">{symbol}</div>
              <div className="text-right">
                <div className="font-bold">
                  ${data.current_price.toLocaleString()}
                </div>
                <div
                  className={`text-xs font-bold ${
                    data.price_change_percentage_24h >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {data.price_change_percentage_24h > 0 ? "+" : ""}
                  {data.price_change_percentage_24h.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
