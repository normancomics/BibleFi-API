-- BibleFi API — Supabase Schema
-- Run this in the Supabase SQL editor to initialise all required tables.
-- Requires the pgvector extension: CREATE EXTENSION IF NOT EXISTS vector;

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── biblical_knowledge_base ───────────────────────────────────────────────────
-- Stores Bible verses with pgvector embeddings for semantic search.
CREATE TABLE IF NOT EXISTS biblical_knowledge_base (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference     TEXT NOT NULL,          -- e.g. "Proverbs 21:5"
  text          TEXT NOT NULL,          -- English translation
  hebrew        TEXT,                   -- Original Hebrew (OT)
  greek         TEXT,                   -- Original Greek (NT)
  transliteration TEXT,
  category      TEXT,                   -- e.g. "wisdom", "wealth", "fear"
  tags          TEXT[],
  embedding     vector(1536),           -- text-embedding-3-small dimension
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bkb_embedding
  ON biblical_knowledge_base USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- pgvector match function used by queryScriptures()
CREATE OR REPLACE FUNCTION match_scriptures(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  id              UUID,
  reference       TEXT,
  text            TEXT,
  hebrew          TEXT,
  greek           TEXT,
  transliteration TEXT,
  category        TEXT,
  tags            TEXT[],
  similarity      FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.reference,
    b.text,
    b.hebrew,
    b.greek,
    b.transliteration,
    b.category,
    b.tags,
    1 - (b.embedding <=> query_embedding) AS similarity
  FROM biblical_knowledge_base b
  WHERE b.embedding IS NOT NULL
    AND 1 - (b.embedding <=> query_embedding) > match_threshold
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── churches ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS churches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  address         TEXT NOT NULL,
  city            TEXT NOT NULL,
  state           TEXT,
  country         TEXT DEFAULT 'US',
  denomination    TEXT,
  website         TEXT,
  accepts_crypto  BOOLEAN DEFAULT FALSE,
  wallet_address  TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  last_verified   TIMESTAMPTZ,
  deleted         BOOLEAN DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_churches_city        ON churches (city);
CREATE INDEX IF NOT EXISTS idx_churches_denomination ON churches (denomination);
CREATE INDEX IF NOT EXISTS idx_churches_crypto       ON churches (accepts_crypto);
CREATE INDEX IF NOT EXISTS idx_churches_deleted      ON churches (deleted);

-- ── validators ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS validators (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address         TEXT NOT NULL UNIQUE,  -- EVM wallet address
  name            TEXT,
  accuracy_score  FLOAT DEFAULT 0,       -- 0–100
  pool_units      TEXT DEFAULT '0',      -- Superfluid GDA units (as string for bigint safety)
  active          BOOLEAN DEFAULT TRUE,
  last_reward_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validators_active  ON validators (active);
CREATE INDEX IF NOT EXISTS idx_validators_address ON validators (address);

-- ── market_cache ──────────────────────────────────────────────────────────────
-- Rolling cache of market snapshots. Pruned to last 100 rows by background job.
CREATE TABLE IF NOT EXISTS market_cache (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_cache_created ON market_cache (created_at DESC);

-- ── streams ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS streams (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash    TEXT,
  sender     TEXT NOT NULL,
  receiver   TEXT NOT NULL,
  flow_rate  TEXT NOT NULL,
  token      TEXT NOT NULL,
  active     BOOLEAN DEFAULT TRUE,
  network    TEXT DEFAULT 'base',
  chain_id   INT DEFAULT 8453,
  stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streams_active   ON streams (active);
CREATE INDEX IF NOT EXISTS idx_streams_sender   ON streams (sender);
CREATE INDEX IF NOT EXISTS idx_streams_receiver ON streams (receiver);

-- ── bwsp_query_log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bwsp_query_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event      TEXT NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security (optional — enable per table as needed) ────────────────
-- ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE validators ENABLE ROW LEVEL SECURITY;
