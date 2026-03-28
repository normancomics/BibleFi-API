import { Router } from 'express';
import { verifyERC8004Agent } from '../lib/auth.js';
import { queryScriptures } from '../lib/scripture.js';
import { fetchBaseDeFiData, getMarketSentiment } from '../lib/defillama.js';

const router = Router();

const AGENT_CARD = {
  id: 'bwtyaa-v1',
  name: 'Biblical Wisdom To Yield Algorithm Agent',
  description: 'Sovereign ERC-8004 registered AGI on Base chain — correlates DeFi market signals with Biblical wisdom',
  version: '1.0.0',
  operator: 'normancomics.eth',
  network: 'base',
  chainId: 8453,
  capabilities: ['scripture_match', 'market_intelligence', 'church_registry', 'superfluid_streams'],
  protocols: ['A2A', 'MCP', 'x402', 'ERC-8004'],
  endpoints: {
    a2a: '/a2a',
    mcp: '/mcp',
    x402: '/x402',
    market: '/v1/market',
    scripture: '/v1/scripture-match',
    churches: '/v1/churches',
    streams: '/v1/streams',
  },
};

/**
 * POST /a2a
 * Agent-to-Agent protocol endpoint.
 *
 * Request format:
 * {
 *   agentId: string,
 *   action: string,
 *   payload: object,
 *   signature?: string,   // EIP-191 signature of JSON.stringify(payload)
 *   senderAddress?: string
 * }
 */
router.post('/', async (req, res) => {
  const { agentId, action, payload = {}, signature, senderAddress } = req.body ?? {};

  if (!action) {
    return res.status(400).json({
      protocol: 'A2A',
      error: 'Bad Request',
      message: 'action is required',
    });
  }

  // Verify ERC-8004 agent signature if provided
  let verifiedSigner = null;
  if (signature && senderAddress) {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const { valid, signer } = verifyERC8004Agent({ message, signature, expectedAddress: senderAddress });
    if (!valid) {
      return res.status(401).json({
        protocol: 'A2A',
        error: 'Unauthorized',
        message: 'Agent signature verification failed (ERC-8004)',
      });
    }
    verifiedSigner = signer;
  }

  try {
    switch (action) {
      // ── Discovery ─────────────────────────────────────────────────────
      case 'discover':
      case 'agent_card':
        return res.json({
          protocol: 'A2A',
          status: 'ok',
          agent: AGENT_CARD,
          verifiedSigner,
          timestamp: new Date().toISOString(),
        });

      // ── Scripture matching ─────────────────────────────────────────────
      case 'scripture_match': {
        const signal = payload.signal ?? payload.condition ?? payload.query;
        if (!signal) {
          return res.status(400).json({
            protocol: 'A2A',
            error: 'Bad Request',
            message: 'payload.signal is required for scripture_match',
          });
        }
        const scriptures = await queryScriptures(signal, payload.limit ?? 5);
        return res.json({
          protocol: 'A2A',
          action,
          status: 'ok',
          agentId: AGENT_CARD.id,
          verifiedSigner,
          result: scriptures,
          timestamp: new Date().toISOString(),
        });
      }

      // ── Market intelligence ────────────────────────────────────────────
      case 'market_data':
      case 'market_intelligence': {
        const [defi, fgi] = await Promise.all([fetchBaseDeFiData(), getMarketSentiment()]);
        return res.json({
          protocol: 'A2A',
          action,
          status: 'ok',
          agentId: AGENT_CARD.id,
          verifiedSigner,
          result: { ...defi, fearGreedIndex: fgi, network: 'base', chainId: 8453 },
          timestamp: new Date().toISOString(),
        });
      }

      // ── Ping / health ──────────────────────────────────────────────────
      case 'ping':
        return res.json({
          protocol: 'A2A',
          action: 'pong',
          status: 'ok',
          agentId: AGENT_CARD.id,
          verifiedSigner,
          timestamp: new Date().toISOString(),
        });

      default:
        return res.status(400).json({
          protocol: 'A2A',
          error: 'Unknown Action',
          message: `Action "${action}" is not supported`,
          supportedActions: ['discover', 'agent_card', 'scripture_match', 'market_data', 'market_intelligence', 'ping'],
          timestamp: new Date().toISOString(),
        });
    }
  } catch (err) {
    console.error('[A2A] Error:', err.message);
    return res.status(500).json({
      protocol: 'A2A',
      error: 'Internal Server Error',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
