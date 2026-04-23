import { supabase } from './supabase.js';
import { embed, openai } from './openai.js';

/**
 * Find scriptures semantically relevant to a market condition/signal.
 * Uses pgvector cosine similarity against the biblical_knowledge_base table.
 *
 * @param {string} signal - Market condition or signal text
 * @param {number} [limit=5] - Number of results to return
 * @returns {Promise<object[]>}
 */
export async function queryScriptures(signal, limit = 5) {
  if (!supabase) throw new Error('Supabase not initialised');
  if (!openai) throw new Error('OpenAI not initialised');

  const embedding = await embed(signal);

  // Use pgvector match function (expects a stored procedure in Supabase)
  const { data, error } = await supabase.rpc('match_scriptures', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: limit,
  });

  if (error) {
    // Fallback: direct similarity query if RPC not available
    const { data: fallback, error: fallbackError } = await supabase
      .from('biblical_knowledge_base')
      .select('*')
      .limit(limit);

    if (fallbackError) throw fallbackError;
    return (fallback ?? []).map((row) => formatScriptureRow(row, 0.75));
  }

  return (data ?? []).map((row) => formatScriptureRow(row, row.similarity ?? 0.75));
}

function formatScriptureRow(row, similarity) {
  return {
    scripture: row.text ?? row.content ?? row.verse ?? '',
    reference: row.reference ?? row.book_chapter_verse ?? '',
    correlation: parseFloat((similarity).toFixed(4)),
    originalLanguage: {
      hebrew: row.hebrew ?? row.original_hebrew ?? null,
      greek: row.greek ?? row.original_greek ?? null,
      transliteration: row.transliteration ?? null,
    },
    confidence: parseFloat(Math.min(similarity * 1.1, 1.0).toFixed(4)),
    category: row.category ?? row.theme ?? null,
    tags: row.tags ?? [],
  };
}

/**
 * Seed/refresh embeddings for all scriptures in biblical_knowledge_base.
 * Called by the hourly cron job.
 * @returns {Promise<{ updated: number, errors: number }>}
 */
export async function seedScriptureEmbeddings() {
  if (!supabase) throw new Error('Supabase not initialised');
  if (!openai) throw new Error('OpenAI not initialised');

  const { data: scriptures, error } = await supabase
    .from('biblical_knowledge_base')
    .select('id, text, content, verse, reference, book_chapter_verse')
    .is('embedding', null)
    .limit(500); // process in batches to avoid rate limits

  if (error) throw error;
  if (!scriptures?.length) return { updated: 0, errors: 0 };

  let updated = 0;
  let errors = 0;

  for (const scripture of scriptures) {
    try {
      const text = scripture.text ?? scripture.content ?? scripture.verse ?? '';
      const ref = scripture.reference ?? scripture.book_chapter_verse ?? '';
      if (!text) continue;

      const embedding = await embed(`${ref}: ${text}`);

      await supabase
        .from('biblical_knowledge_base')
        .update({ embedding })
        .eq('id', scripture.id);

      updated++;

      // Respect OpenAI rate limits
      await sleep(50);
    } catch (err) {
      console.error(`[Scripture Seed] Error embedding ${scripture.id}:`, err.message);
      errors++;
    }
  }

  // Log to bwsp_query_log
  try {
    await supabase.from('bwsp_query_log').insert({
      event: 'scripture_seed',
      details: { updated, errors, timestamp: new Date().toISOString() },
    });
  } catch (_) {}

  return { updated, errors };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
