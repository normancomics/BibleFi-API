import { Router } from 'express';
import { queryScriptures } from '../lib/scripture.js';

const router = Router();

/**
 * POST /v1/scripture-match
 * Body: { signal: string, condition?: string, limit?: number }
 *
 * Finds scriptures semantically relevant to a market condition using
 * OpenAI embeddings + pgvector cosine similarity.
 */
router.post('/', async (req, res) => {
  const { signal, condition, limit = 5 } = req.body ?? {};
  const query = signal ?? condition;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Provide a "signal" or "condition" string in the request body',
    });
  }

  try {
    const scriptures = await queryScriptures(query.trim(), Math.min(Number(limit) || 5, 20));

    if (!scriptures.length) {
      return res.json({
        query,
        results: [],
        message: 'No matching scriptures found — ensure biblical_knowledge_base is seeded',
        timestamp: new Date().toISOString(),
      });
    }

    // Return the top result in the legacy flat format + full results array
    const top = scriptures[0];
    return res.json({
      scripture: top.scripture,
      reference: top.reference,
      correlation: top.correlation,
      originalLanguage: top.originalLanguage,
      confidence: top.confidence,
      query,
      results: scriptures,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Scripture] Error:', err.message);

    // Graceful degradation: return a static fallback if embeddings unavailable
    return res.status(503).json({
      error: 'Scripture matching temporarily unavailable',
      message: err.message,
      fallback: {
        scripture:
          'The plans of the diligent lead to profit as surely as haste leads to poverty.',
        reference: 'Proverbs 21:5',
        correlation: 0.87,
        originalLanguage: { hebrew: 'מַחְשְׁבוֹת חָרוּץ', greek: null, transliteration: 'machshevot charuts' },
        confidence: 0.87,
      },
    });
  }
});

export default router;
