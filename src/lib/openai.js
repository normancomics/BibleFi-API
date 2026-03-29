import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn('[OpenAI] OPENAI_API_KEY not set — embedding features disabled');
}

export const openai = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Generate an embedding vector for the given text.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  if (!openai) throw new Error('OpenAI client not initialised — set OPENAI_API_KEY');
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8191),
  });
  return response.data[0].embedding;
}
