import axios from 'axios';

const BASE_CHAIN_ID = 'base';
const DEFILLAMA_BASE = 'https://api.llama.fi';

/**
 * Fetch the top 10 Base-chain protocols by TVL from DefiLlama.
 * @returns {Promise<{ protocols: object[], tvl: string }>}
 */
export async function fetchBaseDeFiData() {
  // Fetch all protocols and filter to Base chain
  const [protocolsRes, chainsRes] = await Promise.all([
    axios.get(`${DEFILLAMA_BASE}/protocols`, { timeout: 10_000 }),
    axios.get(`${DEFILLAMA_BASE}/v2/chains`, { timeout: 10_000 }),
  ]);

  const allProtocols = protocolsRes.data ?? [];
  const chainData = chainsRes.data ?? [];

  // Find Base chain TVL
  const baseChain = chainData.find(
    (c) => c.name?.toLowerCase() === 'base' || c.gecko_id === 'base',
  );
  const baseTvlRaw = baseChain?.tvl ?? 0;

  // Filter protocols that include Base chain
  const baseProtocols = allProtocols
    .filter((p) => {
      const chains = p.chains ?? [];
      return chains.some((c) => c.toLowerCase() === BASE_CHAIN_ID);
    })
    .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      symbol: p.symbol ?? null,
      category: p.category ?? null,
      tvl: p.tvl ?? 0,
      tvlFormatted: formatUsd(p.tvl ?? 0),
      change24h: p.change_1d ?? null,
      url: p.url ?? null,
    }));

  return {
    protocols: baseProtocols,
    tvl: formatUsd(baseTvlRaw),
    tvlRaw: baseTvlRaw,
  };
}

/**
 * Fetch the Crypto Fear & Greed Index from alternative.me.
 * @returns {Promise<number>}
 */
export async function getMarketSentiment() {
  try {
    const res = await axios.get('https://api.alternative.me/fng/?limit=1', {
      timeout: 8_000,
    });
    const value = parseInt(res.data?.data?.[0]?.value ?? '50', 10);
    return isNaN(value) ? 50 : value;
  } catch {
    return 50; // neutral fallback
  }
}

function formatUsd(value) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}
