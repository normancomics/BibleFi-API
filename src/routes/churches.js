import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import {
  queryChurches,
  createChurch,
  updateChurch,
  deleteChurch,
} from '../lib/churches.js';

const router = Router();

/**
 * GET /v1/churches
 * Query params: city, denomination, acceptsCrypto, page, limit
 */
router.get('/', async (req, res) => {
  try {
    const { city, denomination, page = 1, limit = 20 } = req.query;
    const acceptsCrypto =
      req.query.acceptsCrypto === 'true'
        ? true
        : req.query.acceptsCrypto === 'false'
        ? false
        : undefined;

    const result = await queryChurches({
      city,
      denomination,
      acceptsCrypto,
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10) || 20, 100),
    });

    return res.json(result);
  } catch (err) {
    console.error('[Churches GET] Error:', err.message);
    return res.status(500).json({ error: 'Failed to query churches', message: err.message });
  }
});

/**
 * POST /v1/churches (OAuth protected)
 * Body: { name, address, city, state, country, denomination, website, acceptsCrypto, walletAddress }
 */
router.post('/', requireAuth, async (req, res) => {
  const { name, address, city } = req.body ?? {};

  if (!name || !address || !city) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'name, address, and city are required',
    });
  }

  try {
    const church = await createChurch(req.body);
    return res.status(201).json(church);
  } catch (err) {
    console.error('[Churches POST] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create church', message: err.message });
  }
});

/**
 * PUT /v1/churches/:id (OAuth protected)
 */
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Church ID required' });

  try {
    const church = await updateChurch(id, req.body);
    return res.json(church);
  } catch (err) {
    console.error('[Churches PUT] Error:', err.message);
    const status = err.message?.includes('not found') ? 404 : 500;
    return res.status(status).json({ error: 'Failed to update church', message: err.message });
  }
});

/**
 * DELETE /v1/churches/:id (OAuth protected)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Church ID required' });

  try {
    const church = await deleteChurch(id);
    return res.json({ message: 'Church deleted', church });
  } catch (err) {
    console.error('[Churches DELETE] Error:', err.message);
    const status = err.message?.includes('not found') ? 404 : 500;
    return res.status(status).json({ error: 'Failed to delete church', message: err.message });
  }
});

export default router;
