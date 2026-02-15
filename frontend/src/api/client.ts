const BASE_URL = import.meta.env.VITE_API_URL || "";

// Market stats types (CoinGecko)
export interface MarketStats {
  price: number;
  change24h: number;
  changePercent24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: string;
}

// Symbol mapping for CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'DOGE': 'dogecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'ATOM': 'cosmos',
  'LTC': 'litecoin',
  'BCH': 'bitcoin-cash',
  'NEAR': 'near',
  'APT': 'aptos',
  'ARB': 'arbitrum',
  'OP': 'optimism',
};

function getCoinGeckoId(symbol: string): string | null {
  // Extract base currency from symbol like "BTC-USD" or "BTC/USD"
  const base = symbol.split(/[-/]/)[0].toUpperCase();
  return COINGECKO_IDS[base] || null;
}

export async function fetchMarketStats(symbol: string): Promise<MarketStats | null> {
  const coinId = getCoinGeckoId(symbol);
  if (!coinId) return null;

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const coin = data[coinId];
    if (!coin) return null;

    const price = coin.usd;
    const changePercent24h = coin.usd_24h_change || 0;
    const change24h = price * (changePercent24h / 100);

    return {
      price,
      change24h,
      changePercent24h,
      marketCap: coin.usd_market_cap || 0,
      volume24h: coin.usd_24h_vol || 0,
      lastUpdated: new Date(coin.last_updated_at * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

// Indicator types
export interface IndicatorInfo {
  name: string;
  description: string;
  default_params: Record<string, number>;
}

export interface IndicatorDataPoint {
  date: string;
  [key: string]: string | number; // indicator values like 'ema', 'rsi', 'bb_upper', etc.
}

export async function listIndicators(): Promise<IndicatorInfo[]> {
  const res = await fetch(`${BASE_URL}/api/indicators`);
  if (!res.ok) throw new Error(`List indicators failed: ${res.statusText}`);
  return res.json();
}

export async function fetchIndicator(
  symbol: string,
  indicator: string,
  interval: string = "1d",
  start?: string,
  end?: string,
  params?: Record<string, number>
): Promise<{ data: IndicatorDataPoint[] }> {
  const res = await fetch(`${BASE_URL}/api/indicators/compute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, indicator, interval, start, end, params }),
  });
  if (!res.ok) throw new Error(`Indicator fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchOHLCV(
  symbol: string,
  interval: string,
  start: string,
  end: string,
  equityProvider: string = "yfinance"
) {
  const params = new URLSearchParams({ symbol, interval, start, end, equity_provider: equityProvider });
  const res = await fetch(`${BASE_URL}/api/data/ohlcv?${params}`);
  if (!res.ok) throw new Error(`OHLCV fetch failed: ${res.statusText}`);
  return res.json();
}

export async function configureDataProvider(
  provider: string,
  apiKey: string,
  apiSecret: string
): Promise<{ status: string; provider?: string; message?: string }> {
  const res = await fetch(`${BASE_URL}/api/data/configure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, api_key: apiKey, api_secret: apiSecret }),
  });
  if (!res.ok) throw new Error(`Configure provider failed: ${res.statusText}`);
  return res.json();
}

export async function fetchStrategies() {
  const res = await fetch(`${BASE_URL}/api/strategies`);
  if (!res.ok) throw new Error(`Strategies fetch failed: ${res.statusText}`);
  return res.json();
}

export async function runBacktest(
  symbol: string,
  strategy: string,
  start: string,
  end: string,
  params: Record<string, unknown> = {}
) {
  const res = await fetch(`${BASE_URL}/api/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, strategy, start, end, params }),
  });
  if (!res.ok) throw new Error(`Backtest failed: ${res.statusText}`);
  return res.json();
}

export async function runCustomBacktest(
  symbol: string,
  code: string,
  start: string,
  end: string
) {
  const res = await fetch(`${BASE_URL}/api/backtest/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, code, start, end }),
  });
  if (!res.ok) throw new Error(`Custom backtest failed: ${res.statusText}`);
  return res.json();
}

export async function submitFeatureRequest(
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/feature-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || "Request failed" };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export interface ChatSSEEvent {
  type: "text" | "tool_call" | "tool_result" | "done";
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: string;
}

export interface ChatOptions {
  messages: Array<{ role: string; content: string }>;
  apiKey: string;
  model: string;
  useOpenRouter?: boolean;
}

export async function* streamChat(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model: string = "gpt-4o-mini",
  useOpenRouter: boolean = false
): AsyncGenerator<ChatSSEEvent> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      api_key: apiKey,
      model,
      use_openrouter: useOpenRouter,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat failed: ${res.status} ${text}`);
  }

  if (!res.body) throw new Error("Chat response has no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith("data: ")) {
    try {
      yield JSON.parse(buffer.slice(6));
    } catch {
      // skip
    }
  }
}
