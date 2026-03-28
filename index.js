import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_APP_ID = '69c77ff3f832953fc6c8fd14';
const RAILWAY_URL = 'https://biblefi-api-production.up.railway.app';

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// Root — serves HTML page with base:app_id, fc:frame, og meta tags
app.get('/', (req, res) => {
  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>BibleFi - Biblical DeFi on Base</title>',
    `<meta name="base:app_id" content="${BASE_APP_ID}">`,
    `<meta property="og:title" content="BibleFi - Biblical DeFi on Base">`,
    `<meta property="og:description" content="Biblical wisdom meets DeFi on Base Chain.">`,
    `<meta property="og:url" content="${RAILWAY_URL}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="fc:frame" content="vNext">`,
    `<meta property="fc:frame:image" content="${RAILWAY_URL}/og-image.png">`,
    `<meta property="fc:frame:image:aspect_ratio" content="1.91:1">`,
    `<meta property="fc:frame:button:1" content="Enter BibleFi">`,
    `<meta property="fc:frame:button:1:action" content="link">`,
    `<meta property="fc:frame:button:1:target" content="${RAILWAY_URL}">`,
    `<meta property="fc:frame:post_url" content="${RAILWAY_URL}/api/frame">`,
    '</head>',
    '<body style="margin:0;background:#0a0a0a;color:#f5f5f5;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;">',
    '<h1 style="color:#f0c040;font-size:2rem;">BibleFi</h1>',
    '<p style="color:#aaa;max-width:400px;text-align:center;">Biblical Wisdom To Yield Algorithm Agent - ERC-8004 on Base Chain</p>',
    '<code style="background:#111;padding:.5rem 1rem;border-radius:6px;color:#4ade80;">Status: operational</code>',
    '</body>',
    '</html>'
  ].join('\n');

  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
});

// Farcaster Frame POST handler
app.post('/api/frame', (req, res) => {
  res.json({ version: 'vNext', image: `${RAILWAY_URL}/og-image.png`, buttons: [{ label: 'Enter BibleFi', action: 'link', target: RAILWAY_URL }] });
});

// JSON API info endpoint
app.get('/api', (req, res) => {
  res.json({ agent: 'BWTYAA - Biblical Wisdom To Yield Algorithm Agent', version: '2.0.0', status: 'operational', operator: 'normancomics.eth', timestamp: new Date().toISOString(), base_app_id: BASE_APP_ID, endpoints: { a2a: '/a2a', mcp: '/mcp', x402: '/x402', market: '/v1/market', scripture: '/v1/scripture-match', churches: '/v1/churches', streams: '/v1/streams', private: '/v1/private' } });
});

app.post('/a2a', (req, res) => { res.json({ protocol: 'A2A', status: 'operational', message: 'Agent-to-Agent communication endpoint' }); });
app.post('/mcp', (req, res) => { res.json({ protocol: 'MCP', status: 'operational', message: 'Model Context Protocol endpoint' }); });
app.post('/x402', (req, res) => { res.status(402).json({ protocol: 'x402', message: 'Payment Required', payment_required: true, accepted_currencies: ['USDC', 'USDCx', 'ETH'], network: 'base', settlement_address: '0x7bEda57074AA917FF0993fb329E16C2c188baF08' }); });
app.post('/v1/market', (req, res) => { res.json({ capability: 'market_intelligence', status: 'operational', pricing: { model: 'per_request', amount: '0.15', currency: 'USDC', network: 'base' }, demo_data: { base_tvl: '$2.4B', top_dexs: ['Uniswap V3', 'Aerodrome', 'BaseSwap'], fear_greed_index: 65 } }); });
app.post('/v1/scripture-match', (req, res) => { res.json({ capability: 'biblical_defi_correlation', status: 'operational', scripture: { reference: 'Proverbs 21:5', text: 'The thoughts of the diligent tend only to plenteousness; but of every one that is hasty only to want.', correlation: 'Warns against hasty trading during volatility', confidence: 0.87 } }); });
app.post('/v1/churches', (req, res) => { res.json({ capability: 'church_database_access', status: 'coming_soon', authentication: 'OAuth2 required' }); });
app.post('/v1/streams', (req, res) => { res.json({ capability: 'superfluid_streaming', status: 'operational', superfluid_links: { app: 'https://app.superfluid.finance', console: 'https://console.superfluid.finance' } }); });
app.post('/v1/private', (req, res) => { res.json({ capability: 'privacy_transactions', status: 'coming_soon', privacy_tech: { zkp_language: 'Noir', protocol: 'veil.cash' } }); });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BibleFi BWTYA API running on port ${PORT}`);
  console.log(`Base App ID: ${BASE_APP_ID}`);
});