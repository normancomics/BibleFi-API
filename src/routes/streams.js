import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import {
  createSuperfluidStream,
  deleteSuperfluidStream,
  getFlow,
} from '../lib/superfluid.js';
import { supabase } from '../lib/supabase.js';
import { isAddress } from 'viem';

const router = Router();

const DEFAULT_TOKEN = process.env.SUPERFLUID_USDCX_ADDRESS ?? '0xD04383398dD2426297da660F9CCA3d439AF9ce1b'; // USDCx on Base

/**
 * GET /v1/streams
 * List active Superfluid streams from the database.
 */
router.get('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({
        streams: [],
        message: 'Database not configured',
        superfluid: {
          app: 'https://app.superfluid.finance',
          console: 'https://console.superfluid.finance',
          network: 'base',
        },
      });
    }

    const { data: streams, error } = await supabase
      .from('streams')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      streams: streams ?? [],
      count: streams?.length ?? 0,
      network: 'base',
      chainId: 8453,
    });
  } catch (err) {
    console.error('[Streams GET] Error:', err.message);
    return res.status(500).json({ error: 'Failed to list streams', message: err.message });
  }
});

/**
 * POST /v1/streams (protected)
 * Body: { receiver: address, flowRate: string, token?: address }
 */
router.post('/', requireAuth, async (req, res) => {
  const { receiver, flowRate, token = DEFAULT_TOKEN } = req.body ?? {};

  if (!receiver || !flowRate) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'receiver (address) and flowRate (wei/second as string) are required',
    });
  }

  if (!isAddress(receiver)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid receiver address' });
  }

  try {
    const stream = await createSuperfluidStream({ receiver, flowRate, token });

    // Persist to database
    if (supabase) {
      await supabase.from('streams').insert({
        tx_hash: stream.txHash,
        sender: stream.sender,
        receiver,
        flow_rate: flowRate,
        token,
        active: true,
        network: 'base',
        chain_id: 8453,
      }).catch(() => {});
    }

    return res.status(201).json(stream);
  } catch (err) {
    console.error('[Streams POST] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create stream', message: err.message });
  }
});

/**
 * GET /v1/streams/:streamId
 * Get stream details. streamId format: sender-receiver or a DB UUID.
 */
router.get('/:streamId', async (req, res) => {
  const { streamId } = req.params;

  try {
    // Try DB lookup first
    if (supabase) {
      const { data: stream } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .single();

      if (stream) {
        // Enrich with on-chain data
        try {
          const onChain = await getFlow({
            sender: stream.sender,
            receiver: stream.receiver,
            token: stream.token,
          });
          return res.json({ ...stream, onChain });
        } catch {
          return res.json(stream);
        }
      }
    }

    return res.status(404).json({ error: 'Stream not found', streamId });
  } catch (err) {
    console.error('[Streams GET/:id] Error:', err.message);
    return res.status(500).json({ error: 'Failed to get stream', message: err.message });
  }
});

/**
 * DELETE /v1/streams/:streamId (protected)
 * Stop a Superfluid stream.
 */
router.delete('/:streamId', requireAuth, async (req, res) => {
  const { streamId } = req.params;

  try {
    let stream = null;

    if (supabase) {
      const { data } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .single();
      stream = data;
    }

    if (!stream) {
      return res.status(404).json({ error: 'Stream not found', streamId });
    }

    const result = await deleteSuperfluidStream({
      receiver: stream.receiver,
      token: stream.token,
    });

    // Mark as inactive in DB
    if (supabase) {
      await supabase
        .from('streams')
        .update({ active: false, stopped_at: new Date().toISOString() })
        .eq('id', streamId)
        .catch(() => {});
    }

    return res.json({ message: 'Stream stopped', ...result });
  } catch (err) {
    console.error('[Streams DELETE] Error:', err.message);
    return res.status(500).json({ error: 'Failed to stop stream', message: err.message });
  }
});

export default router;
