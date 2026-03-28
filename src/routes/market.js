import { Router } from 'express';
import { fetchBaseDeFiData, getMarketSentiment } from '../lib/defillama.js';
import { supabase } from '../lib/supabase.js';

const router = Router();
const CACHE_TTL_MS = 5_000; // 5-second TTL

/**
 * POST /v1/market
 * Returns Base chain DeFi data with Fear & Greed Index.
 * Results are cached for 5 seconds in market_cache table.
 */
router.post('/', async (req, res) => {
  try {
    // 1. Try in-memory cache first (populated by background job)
    if (supabase) {
      const { data: cached } = await supabase
        .from('market_cache')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (cached) {
        const age = Date.now() - new Date(cached.created_at).getTime();
        if (age < CACHE_TTL_MS) {
          return res.json({ ...cached.data, cached: true, cacheAge: age });
        }
      }
    }

    // 2. Fetch fresh data
    const [defiData, fearGreedIndex] = await Promise.all([
      fetchBaseDeFiData(),
      getMarketSentiment(),
    ]);

    const payload = {
      protocols: defiData.protocols,
      tvl: defiData.tvl,
      fearGreedIndex,
      fearGreedLabel: getFearGreedLabel(fearGreedIndex),
      network: 'base',
      chainId: 8453,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    // 3. Persist to cache
    if (supabase) {
      await supabase.from('market_cache').insert({ data: payload }).catch(() => {});
    }

    return res.json(payload);
  } catch (err) {
    console.error('[Market] Error fetching data:', err.message);

    // Fallback: return last cached entry even if stale
    if (supabase) {
      const { data: stale } = await supabase
        .from('market_cache')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        .catch(() => ({ data: null }));

      if (stale) {
        return res.json({ ...stale.data, cached: true, stale: true });
      }
    }

    return res.status(503).json({
      error: 'Market data temporarily unavailable',
      message: err.message,
      fallback: {
        protocols: [],
        tvl: '$0',
        fearGreedIndex: 50,
        fearGreedLabel: 'Neutral',
        network: 'base',
        chainId: 8453,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

function getFearGreedLabel(index) {
  if (index <= 24) return 'Extreme Fear';
  if (index <= 44) return 'Fear';
  if (index <= 55) return 'Neutral';
  if (index <= 74) return 'Greed';
  return 'Extreme Greed';
}

export default router;
