import axios from 'axios';
import { supabase } from './supabase.js';

/**
 * Verify a church address via Google Maps Geocoding API.
 * @param {string} address
 * @returns {Promise<{ valid: boolean, formatted: string|null, lat: number|null, lng: number|null }>}
 */
export async function verifyChurchAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('[Churches] GOOGLE_MAPS_API_KEY not set — skipping address verification');
    return { valid: true, formatted: address, lat: null, lng: null };
  }

  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address, key: apiKey },
      timeout: 8_000,
    });

    const results = res.data?.results ?? [];
    if (!results.length) return { valid: false, formatted: null, lat: null, lng: null };

    const location = results[0].geometry?.location;
    return {
      valid: true,
      formatted: results[0].formatted_address,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
    };
  } catch (err) {
    console.error('[Churches] Address verification failed:', err.message);
    return { valid: false, formatted: null, lat: null, lng: null };
  }
}

/**
 * Query churches with optional filters.
 * @param {{ city?: string, denomination?: string, acceptsCrypto?: boolean, page?: number, limit?: number }} filters
 */
export async function queryChurches({ city, denomination, acceptsCrypto, page = 1, limit = 20 } = {}) {
  if (!supabase) throw new Error('Supabase not initialised');

  let query = supabase
    .from('churches')
    .select('*', { count: 'exact' })
    .eq('deleted', false)
    .order('name', { ascending: true })
    .range((page - 1) * limit, page * limit - 1);

  if (city) query = query.ilike('city', `%${city}%`);
  if (denomination) query = query.ilike('denomination', `%${denomination}%`);
  if (acceptsCrypto !== undefined) query = query.eq('accepts_crypto', acceptsCrypto);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    churches: data ?? [],
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  };
}

/**
 * Create a new church entry.
 * @param {object} churchData
 */
export async function createChurch(churchData) {
  if (!supabase) throw new Error('Supabase not initialised');

  const { name, address, city, state, country, denomination, website, acceptsCrypto, walletAddress } = churchData;

  // Verify address
  const geo = await verifyChurchAddress(`${address}, ${city}, ${state ?? ''}, ${country ?? ''}`);
  if (!geo.valid) throw new Error('Could not verify church address via Google Maps');

  const { data, error } = await supabase
    .from('churches')
    .insert({
      name,
      address: geo.formatted ?? address,
      city,
      state,
      country,
      denomination,
      website,
      accepts_crypto: acceptsCrypto ?? false,
      wallet_address: walletAddress ?? null,
      lat: geo.lat,
      lng: geo.lng,
      deleted: false,
      last_verified: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing church entry.
 * @param {string} id
 * @param {object} updates
 */
export async function updateChurch(id, updates) {
  if (!supabase) throw new Error('Supabase not initialised');

  const payload = { ...updates, updated_at: new Date().toISOString() };

  // Re-verify address if it changed
  if (updates.address || updates.city || updates.state || updates.country) {
    const { data: existing } = await supabase.from('churches').select('*').eq('id', id).single();
    if (existing) {
      const addr = `${updates.address ?? existing.address}, ${updates.city ?? existing.city}, ${updates.state ?? existing.state ?? ''}, ${updates.country ?? existing.country ?? ''}`;
      const geo = await verifyChurchAddress(addr);
      if (geo.valid) {
        payload.address = geo.formatted ?? payload.address;
        payload.lat = geo.lat;
        payload.lng = geo.lng;
        payload.last_verified = new Date().toISOString();
      }
    }
  }

  const { data, error } = await supabase
    .from('churches')
    .update(payload)
    .eq('id', id)
    .eq('deleted', false)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Soft-delete a church.
 * @param {string} id
 */
export async function deleteChurch(id) {
  if (!supabase) throw new Error('Supabase not initialised');

  const { data, error } = await supabase
    .from('churches')
    .update({ deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Verify all churches in the database (called by hourly cron).
 * @returns {Promise<{ verified: number, failed: number }>}
 */
export async function verifyAllChurches() {
  if (!supabase) throw new Error('Supabase not initialised');

  const { data: churches, error } = await supabase
    .from('churches')
    .select('*')
    .eq('deleted', false);

  if (error) throw error;
  if (!churches?.length) return { verified: 0, failed: 0 };

  let verified = 0;
  let failed = 0;

  for (const church of churches) {
    try {
      const addr = `${church.address}, ${church.city}, ${church.state ?? ''}, ${church.country ?? ''}`;
      const geo = await verifyChurchAddress(addr);

      await supabase
        .from('churches')
        .update({
          last_verified: new Date().toISOString(),
          lat: geo.lat ?? church.lat,
          lng: geo.lng ?? church.lng,
        })
        .eq('id', church.id);

      verified++;
      await sleep(200); // respect Google Maps rate limits
    } catch (err) {
      console.error(`[Churches] Verification failed for ${church.id}:`, err.message);
      failed++;
    }
  }

  return { verified, failed };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
