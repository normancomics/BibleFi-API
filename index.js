import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Base App ID (Base Build verification) ───────────────────────────────────
const BASE_APP_ID = '69c77ff3f832953fc6c8fd14';
const RAILWAY_URL = 'https://biblefi-api-production.up.railway.app';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ─── Root — serves HTML with ALL required meta tags ──────────────────────────
// This satisfies:
//   1. Base Build analytics verification  (base:app_id)
//   2. Farcaster Mini-App Frame v2        (fc:frame)
//   3. Open Graph                         (og:*)
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>BibleFi — Biblical DeFi on Base</title>\n\n  <!-- Base Build / Base App analytics verification -->\n  <meta name="base:app_id" content="${BASE_APP_ID}" />\n\n  <!-- Open Graph -->\n  <meta property="og:title" content="BibleFi — Biblical DeFi on Base" />\n  <meta property="og:description" content="Biblical wisdom meets DeFi on Base Chain. Tithe, Stake, Lend and Farm guided by scripture." />\n  <meta property="og:image" content="${RAILWAY_URL}/og-image.png" />\n  <meta property="og:url" content="${RAILWAY_URL}" />\n  <meta property="og:type" content="website" />\n\n  <!-- Farcaster Mini-App Frame v2 -->\n  <meta property="fc:frame" content="vNext" />\n  <meta property="fc:frame:image" content="${RAILWAY_URL}/og-image.png" />\n  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />\n  <meta property="fc:frame:button:1" content="Biblical Wisdom" />\n  <meta property="fc:frame:button:1:action" content="link" />\n  <meta property="fc:frame:button:1:target" content="${RAILWAY_URL}" />\n  <meta property="fc:frame:button:2" content="DeFi Swaps" />\n  <meta property="fc:frame:button:2:action" content="link" />\n  <meta property="fc:frame:button:2:target" content="${RAILWAY_URL}" />\n  <meta property="fc:frame:button:3" content="Tithe" />\n  <meta property="fc:frame:button:3:action" content="link" />\n  <meta property="fc:frame:button:3:target" content="${RAILWAY_URL}" />\n  <meta property="fc:frame:post_url" content="${RAILWAY_URL}/api/frame" />\n</head>\n<body style="margin:0;background:#0a0a0a;color:#f5f5f5;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;">\n  <h1 style="color:#f0c040;font-size:2rem;">BibleFi</h1>\n  <p style="color:#aaa;max-width:400px;text-align:center;">\n    Biblical Wisdom To Yield Algorithm (BWTYA) Agent API — Sovereign ERC-8004 on Base Chain\n  </p>\n  <code style="background:#111;padding:.5rem 1rem;border-radius:6px;color:#4ade80;">\n    Status: operational\n  </code>\n</body>\n</html>`);
});

// ─── Farcaster Frame handler ──────────────────────────────────────────────────
app.post('/api/frame', (req, res) => {
  res.json({
    version: 'vNext',
    image: `${RAILWAY_URL}/og-image.png`,
    buttons: [
      { label: 'Enter BibleFi', action: 'link', target: RAILWAY_URL }
    ]
  });
});

// ─── JSON API root (for programmatic access) ─────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    agent: 'BWTYAA - Biblical Wisdom To Yield Algorithm Agent',
    version: '2.0.0',
    status: 'operational',
    operator: 'normancomics.eth',
    timestamp: new Date().toISOString(),
    base_app_id: BASE_APP_ID,
    endpoints: {
      a2a: '/a2a',
      mcp: '/mcp',
      x402: '/x402',
      market: '/v1/market',
      scripture: '/v1/scripture-match',
      churches: '/v1/churches',
      streams: '/v1/streams',
      private: '/v1/private'
    }
  });
});

// ─── Agent / Protocol endpoints ───────────────────────────────────────────────
app.post('/a2a', (req, res) => {
  res.json({
    protocol: 'A2A',
    status: 'operational',
    message: 'Agent-to-Agent communication endpoint'
  });
});

app.post('/mcp', (req, res) => {
  res.json({
    protocol: 'MCP',
    status: 'operational',
    message: 'Model Context Protocol endpoint'
  });
});

app.post('/x402', (req, res) => {
  res.status(402).json({
    protocol: 'x402',
    message: 'Payment Required',
    payment_required: true,
    accepted_currencies: ['USDC', 'USDCx', 'ETH'],
    network: 'base',
    settlement_address: '0x7bEda57074AA917FF0993fb329E16C2c188baF08'
  });
});

app.post('/v1/market', (req, res) => {
  res.json({
    capability: 'market_intelligence',
    status: 'operational',
    pricing: {
      model: 'per_request',
      amount: '0.15',
      currency: 'USDC',
      network: 'base'
    },
    demo_data: {
      base_tvl: '$2.4B',
      top_dexs: ['Uniswap V3', 'Aerodrome', 'BaseSwap'],
      fear_greed_index: 65
    }
  });
});

app.post('/v1/scripture-match', (req, res) => {
  res.json({
    capability: 'biblical_defi_correlation',
    status: 'operational',
    scripture: {
      reference: 'Proverbs 21:5',
      text: 'The thoughts of the diligent tend only to plenteousness; but of every one that is hasty only to want.',
      correlation: 'Warns against hasty trading during volatility',
      confidence: 0.87
    }
  });
});

app.post('/v1/churches', (req, res) => {
  res.json({
    capability: 'church_database_access',
    status: 'coming_soon',
    authentication: 'OAuth2 required'
  });
});

app.post('/v1/streams', (req, res) => {
  res.json({
    capability: 'superfluid_streaming',
    status: 'operational',
    superfluid_links: {
      app: 'https://app.superfluid.finance',
      console: 'https://console.superfluid.finance'
    }
  });
});

app.post('/v1/private', (req, res) => {
  res.json({
    capability: 'privacy_transactions',
    status: 'coming_soon',
    privacy_tech: {
      zkp_language: 'Noir',
      protocol: 'veil.cash'
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BibleFi BWTYA API running on port ${PORT}`);
  console.log(`Base App ID: ${BASE_APP_ID}`);
  console.log(`URL: ${RAILWAY_URL}`);
});