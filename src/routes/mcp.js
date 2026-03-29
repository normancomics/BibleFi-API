import { Router } from 'express';
import { queryScriptures } from '../lib/scripture.js';
import { fetchBaseDeFiData, getMarketSentiment } from '../lib/defillama.js';

const router = Router();

const AGENT_ID = 'bwtyaa-v1';
const AGENT_NAME = 'Biblical Wisdom To Yield Algorithm Agent';
const SUPPORTED_TOOLS = ['scripture_match', 'market_data', 'church_lookup', 'stream_info'];

/**
 * POST /mcp
 * Model Context Protocol endpoint.
 * Accepts MCP-formatted requests and routes to the appropriate handler.
 *
 * MCP request format:
 * { jsonrpc: '2.0', id: string, method: string, params: object }
 */
router.post('/', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body ?? {};

  // Validate MCP envelope
  if (jsonrpc !== '2.0') {
    return res.status(400).json(mcpError(id, -32600, 'Invalid Request — jsonrpc must be "2.0"'));
  }

  if (!method) {
    return res.status(400).json(mcpError(id, -32600, 'method is required'));
  }

  try {
    switch (method) {
      // ── Agent discovery ──────────────────────────────────────────────
      case 'initialize':
        return res.json(mcpResult(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: AGENT_ID, version: '1.0.0' },
        }));

      case 'tools/list':
        return res.json(mcpResult(id, {
          tools: [
            {
              name: 'scripture_match',
              description: 'Find biblical scriptures relevant to a market condition or signal',
              inputSchema: {
                type: 'object',
                properties: {
                  signal: { type: 'string', description: 'Market condition or signal' },
                  limit: { type: 'number', description: 'Max results (default 5)' },
                },
                required: ['signal'],
              },
            },
            {
              name: 'market_data',
              description: 'Get Base chain DeFi market data and Fear & Greed Index',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        }));

      // ── Tool execution ────────────────────────────────────────────────
      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments ?? {};

        if (toolName === 'scripture_match') {
          const scriptures = await queryScriptures(toolArgs.signal ?? '', toolArgs.limit ?? 5);
          return res.json(mcpResult(id, {
            content: [{ type: 'text', text: JSON.stringify(scriptures, null, 2) }],
          }));
        }

        if (toolName === 'market_data') {
          const [defi, fgi] = await Promise.all([fetchBaseDeFiData(), getMarketSentiment()]);
          return res.json(mcpResult(id, {
            content: [{ type: 'text', text: JSON.stringify({ ...defi, fearGreedIndex: fgi }, null, 2) }],
          }));
        }

        return res.status(400).json(mcpError(id, -32601, `Unknown tool: ${toolName}`));
      }

      // ── Resources ─────────────────────────────────────────────────────
      case 'resources/list':
        return res.json(mcpResult(id, { resources: [] }));

      default:
        return res.status(400).json(mcpError(id, -32601, `Method not found: ${method}`));
    }
  } catch (err) {
    console.error('[MCP] Error:', err.message);
    return res.status(500).json(mcpError(id, -32603, `Internal error: ${err.message}`));
  }
});

function mcpResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function mcpError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export default router;
