import cron from 'node-cron';
import { fetchBaseDeFiData, getMarketSentiment } from '../lib/defillama.js';
import { seedScriptureEmbeddings } from '../lib/scripture.js';
import { verifyAllChurches } from '../lib/churches.js';
import { calculateValidatorRewards } from '../lib/superfluid.js';
import { supabase } from '../lib/supabase.js';

/**
 * Register all background cron jobs.
 * Called once at server startup.
 */
export function registerJobs() {
  console.log('[Jobs] Registering background jobs...');

  // ── 1. Market data refresh every 5 seconds ──────────────────────────
  // Cron doesn't support sub-minute intervals natively; we use setInterval.
  const MARKET_INTERVAL_MS = 5_000;
  setInterval(async () => {
    try {
      const [defiData, fearGreedIndex] = await Promise.all([
        fetchBaseDeFiData(),
        getMarketSentiment(),
      ]);

      const payload = {
        protocols: defiData.protocols,
        tvl: defiData.tvl,
        tvlRaw: defiData.tvlRaw,
        fearGreedIndex,
        network: 'base',
        chainId: 8453,
        timestamp: new Date().toISOString(),
      };

      // Detect whale movements (protocols with >$1M 24h change)
      const whaleMovements = defiData.protocols.filter(
        (p) => p.tvl && Math.abs(p.tvl * (p.change24h ?? 0) / 100) > 1_000_000,
      );

      if (whaleMovements.length) {
        console.log(`[Jobs/Market] 🐋 Whale movement detected in ${whaleMovements.length} protocol(s)`);
      }

      if (supabase) {
        await supabase.from('market_cache').insert({ data: payload });

        // Prune old cache entries (keep last 100)
        const { data: old } = await supabase
          .from('market_cache')
          .select('id')
          .order('created_at', { ascending: true });

        if (old && old.length > 100) {
          const toDelete = old.slice(0, old.length - 100).map((r) => r.id);
          await supabase.from('market_cache').delete().in('id', toDelete);
        }
      }
    } catch (err) {
      // Silently swallow — market refresh is best-effort
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Jobs/Market] Refresh error:', err.message);
      }
    }
  }, MARKET_INTERVAL_MS);

  console.log(`[Jobs] ✅ Market data refresh every ${MARKET_INTERVAL_MS / 1000}s`);

  // ── 2. Hourly scripture embedding seeding (0 * * * *) ───────────────
  cron.schedule('0 * * * *', async () => {
    console.log('[Jobs/Scripture] Starting hourly scripture embedding seed...');
    try {
      const result = await seedScriptureEmbeddings();
      console.log(`[Jobs/Scripture] ✅ Seeded ${result.updated} scriptures (${result.errors} errors)`);
    } catch (err) {
      console.error('[Jobs/Scripture] ❌ Error:', err.message);
    }
  });

  console.log('[Jobs] ✅ Scripture seeding scheduled (hourly)');

  // ── 3. Hourly church database verification (30 * * * *) ─────────────
  // Offset by 30 minutes to avoid colliding with scripture job
  cron.schedule('30 * * * *', async () => {
    console.log('[Jobs/Churches] Starting hourly church verification...');
    try {
      const result = await verifyAllChurches();
      console.log(`[Jobs/Churches] ✅ Verified ${result.verified} churches (${result.failed} failed)`);
    } catch (err) {
      console.error('[Jobs/Churches] ❌ Error:', err.message);
    }
  });

  console.log('[Jobs] ✅ Church verification scheduled (hourly, offset 30m)');

  // ── 4. Validator reward calculation every 15 minutes (*/15 * * * *) ─
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Jobs/Validators] Calculating validator rewards...');
    try {
      const results = await calculateValidatorRewards();
      const updated = results.filter((r) => r.status === 'updated').length;
      const failed = results.filter((r) => r.status === 'failed').length;
      console.log(`[Jobs/Validators] ✅ Updated ${updated} validators (${failed} failed)`);
    } catch (err) {
      console.error('[Jobs/Validators] ❌ Error:', err.message);
    }
  });

  console.log('[Jobs] ✅ Validator rewards scheduled (every 15 minutes)');
  console.log('[Jobs] All background jobs registered.');
}
