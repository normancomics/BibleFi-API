import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// ── Middleware ────────────────────────────────────────────────────────────────
import {
  corsOptions,
  globalRateLimit,
  strictRateLimit,
  requestLogger,
  errorHandler,
} from './src/middleware/index.js';

// ── Route handlers ────────────────────────────────────────────────────────────
import marketRouter    from './src/routes/market.js';
import scriptureRouter from './src/routes/scripture.js';
import churchesRouter  from './src/routes/churches.js';
import streamsRouter   from './src/routes/streams.js';
import x402Router      from './src/routes/x402.js';
import mcpRouter       from './src/routes/mcp.js';
import a2aRouter       from './src/routes/a2a.js';

// ── Background jobs ───────────────────────────────────────────────────────────
import { registerJobs } from './src/jobs/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Core middleware ───────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use(globalRateLimit);

// ── Health / discovery ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    agent: 'BWTYAA - Biblical Wisdom To Yield Algorithm Agent',
    version: '2.0.0',
    status: 'operational',
    operator: 'normancomics.eth',
    network: 'base',
    chainId: 8453,
    timestamp: new Date().toISOString(),
    endpoints: {
      a2a:      '/a2a',
      mcp:      '/mcp',
      x402:     '/x402',
      market:   '/v1/market',
      scripture:'/v1/scripture-match',
      churches: '/v1/churches',
      streams:  '/v1/streams',
      private:  '/v1/private',
    },
    protocols: ['A2A', 'MCP', 'x402', 'ERC-8004'],
  });
});

// ── Protocol endpoints ────────────────────────────────────────────────────────
app.use('/a2a',  a2aRouter);
app.use('/mcp',  mcpRouter);
app.use('/x402', x402Router);

// ── v1 API endpoints ──────────────────────────────────────────────────────────
app.use('/v1/market',          strictRateLimit, marketRouter);
app.use('/v1/scripture-match', strictRateLimit, scriptureRouter);
app.use('/v1/churches',        churchesRouter);
app.use('/v1/streams',         streamsRouter);

// ── /v1/private (placeholder — ZKP / veil.cash integration) ──────────────────
app.post('/v1/private', (req, res) => {
  res.json({
    capability: 'privacy_transactions',
    status: 'coming_soon',
    privacy_tech: {
      zkp_language: 'Noir',
      protocol: 'veil.cash',
    },
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `${req.method} ${req.path} is not a valid endpoint`,
    docs: 'https://biblefi-api-production.up.railway.app/',
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BibleFi BWTYA API v2.0.0 running on port ${PORT}`);
  console.log(`   Network: Base (chainId 8453)`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL ? '✅ connected' : '⚠️  not configured'}`);
  console.log(`   OpenAI:   ${process.env.OPENAI_API_KEY ? '✅ connected' : '⚠️  not configured'}`);
  console.log(`   Viem:     ${process.env.VIEM_PRIVATE_KEY ? '✅ configured' : '⚠️  not configured'}`);

  // Start background jobs
  registerJobs();
});
