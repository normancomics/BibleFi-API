import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { isAddress } from 'viem';

const router = Router();

/**
 * GET /v1/validators
 * List validators from the database.
 * Query params: ?active=true|false (default: true), ?limit=N (default: 50, max: 200)
 */
router.get('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({
        validators: [],
        count: 0,
        message: 'Database not configured',
      });
    }

    const activeParam = req.query.active !== undefined ? req.query.active : 'true';
    const active = activeParam !== 'false';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const { data: validators, error } = await supabase
      .from('validators')
      .select('*')
      .eq('active', active)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return res.json({
      validators: validators ?? [],
      count: validators?.length ?? 0,
    });
  } catch (err) {
    console.error('[Validators GET] Error:', err.message);
    return res.status(500).json({ error: 'Failed to list validators', message: err.message });
  }
});

/**
 * GET /v1/validators/:address
 * Get a single validator by EVM address (case-insensitive).
 */
router.get('/:address', async (req, res) => {
  const address = req.params.address.toLowerCase();

  try {
    if (!supabase) {
      return res.status(404).json({ error: 'Not Found', message: 'Database not configured' });
    }

    const { data: validator, error } = await supabase
      .from('validators')
      .select('*')
      .eq('address', address)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!validator) {
      return res.status(404).json({ error: 'Not Found', message: `Validator ${address} not found` });
    }

    return res.json(validator);
  } catch (err) {
    console.error('[Validators GET/:address] Error:', err.message);
    return res.status(500).json({ error: 'Failed to get validator', message: err.message });
  }
});

/**
 * POST /v1/validators (protected)
 * Register a new validator.
 * Body: { address: string (EVM address), name?: string }
 */
router.post('/', requireAuth, async (req, res) => {
  const { address, name } = req.body ?? {};

  if (!address) {
    return res.status(400).json({ error: 'Bad Request', message: 'address (EVM address) is required' });
  }

  if (!isAddress(address)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid EVM address' });
  }

  const normalizedAddress = address.toLowerCase();

  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'Database not configured' });
    }

    const { data: validator, error } = await supabase
      .from('validators')
      .insert({
        address: normalizedAddress,
        name: name ?? null,
        active: true,
        accuracy_score: 0,
        pool_units: '0',
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'Conflict',
          message: `Validator with address ${normalizedAddress} already exists`,
        });
      }
      throw error;
    }

    return res.status(201).json(validator);
  } catch (err) {
    console.error('[Validators POST] Error:', err.message);
    return res.status(500).json({ error: 'Failed to register validator', message: err.message });
  }
});

/**
 * PUT /v1/validators/:address (protected)
 * Update a validator's name and/or accuracy_score.
 * Body: { name?: string, accuracy_score?: number (0-100) }
 */
router.put('/:address', requireAuth, async (req, res) => {
  const address = req.params.address.toLowerCase();
  const { name, accuracy_score } = req.body ?? {};

  if (accuracy_score !== undefined) {
    const score = Number(accuracy_score);
    if (isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'accuracy_score must be a number between 0 and 100',
      });
    }
  }

  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'Database not configured' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (accuracy_score !== undefined) updates.accuracy_score = Number(accuracy_score);

    const { data: validator, error } = await supabase
      .from('validators')
      .update(updates)
      .eq('address', address)
      .select()
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!validator) {
      return res.status(404).json({ error: 'Not Found', message: `Validator ${address} not found` });
    }

    return res.json(validator);
  } catch (err) {
    console.error('[Validators PUT/:address] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update validator', message: err.message });
  }
});

/**
 * DELETE /v1/validators/:address (protected)
 * Soft-deactivate a validator (set active: false).
 */
router.delete('/:address', requireAuth, async (req, res) => {
  const address = req.params.address.toLowerCase();

  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'Database not configured' });
    }

    const { data: validator, error } = await supabase
      .from('validators')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('address', address)
      .select()
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!validator) {
      return res.status(404).json({ error: 'Not Found', message: `Validator ${address} not found` });
    }

    return res.json({ message: 'Validator deactivated', address });
  } catch (err) {
    console.error('[Validators DELETE/:address] Error:', err.message);
    return res.status(500).json({ error: 'Failed to deactivate validator', message: err.message });
  }
});

export default router;
