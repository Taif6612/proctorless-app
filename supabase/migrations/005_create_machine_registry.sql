-- ============================================
-- Machine Registry for Fingerprint-Based Identification
-- ============================================
-- Stores composite fingerprints (GPU + Canvas + Screen) mapped to physical lab positions.
-- Fingerprints are deterministic hashes regenerated on each session.
-- This table is queried when a student joins a quiz to auto-assign their seat/variant.

-- Drop existing table if needed (uncomment for fresh start)
-- DROP TABLE IF EXISTS machine_registry;

CREATE TABLE IF NOT EXISTS machine_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The SHA-256 hash of the composite fingerprint (GPU + Canvas + Screen)
  -- This is deterministic: same hardware = same hash every time
  fingerprint_hash TEXT UNIQUE NOT NULL,
  
  -- Physical location mapping
  lab_name TEXT NOT NULL,           -- e.g., "Physics Lab A", "Library Computer Room"
  row_index INTEGER NOT NULL,       -- 0-indexed row in the seating grid
  column_index INTEGER NOT NULL,    -- 0-indexed column in the seating grid
  
  -- Optional human-readable label
  machine_label TEXT,               -- e.g., "PC-01", "Workstation-A1"
  
  -- Fingerprint components (for debugging/verification)
  -- Stored as JSON so we can see what changed if fingerprint drifts
  fingerprint_components JSONB,     -- { gpu: "...", canvas: "...", screen: "..." }
  
  -- Metadata
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  registered_by UUID REFERENCES auth.users(id),
  last_seen_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,     -- Last time fingerprint matched
  registration_notes TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,   -- Can be disabled without deleting
  
  -- Ensure unique position per lab
  UNIQUE(lab_name, row_index, column_index)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_machine_fingerprint ON machine_registry(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_machine_lab ON machine_registry(lab_name);
CREATE INDEX IF NOT EXISTS idx_machine_active ON machine_registry(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE machine_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read (needed for fingerprint lookup during quiz)
CREATE POLICY "Anyone can read machine registry"
  ON machine_registry FOR SELECT
  USING (true);

-- Only professors and admins can insert/update/delete
CREATE POLICY "Professors can manage machine registry"
  ON machine_registry FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('professor', 'admin')
    )
  );

-- ============================================
-- Helper function to get variant index
-- ============================================
CREATE OR REPLACE FUNCTION get_variant_for_machine(
  p_fingerprint_hash TEXT,
  p_total_variants INTEGER DEFAULT 3
)
RETURNS TABLE (
  machine_id UUID,
  lab_name TEXT,
  row_index INTEGER,
  column_index INTEGER,
  variant_index INTEGER,
  machine_label TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS machine_id,
    m.lab_name,
    m.row_index,
    m.column_index,
    -- Latin Square formula: ((row * 3) + column) % totalVariants
    ((m.row_index * 3) + m.column_index) % p_total_variants AS variant_index,
    m.machine_label
  FROM machine_registry m
  WHERE m.fingerprint_hash = p_fingerprint_hash
    AND m.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function to update last_seen timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_machine_last_seen(p_fingerprint_hash TEXT)
RETURNS void AS $$
BEGIN
  UPDATE machine_registry 
  SET last_seen_at = NOW(),
      last_verified_at = NOW()
  WHERE fingerprint_hash = p_fingerprint_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_variant_for_machine TO authenticated;
GRANT EXECUTE ON FUNCTION update_machine_last_seen TO authenticated;

COMMENT ON TABLE machine_registry IS 'Maps machine fingerprints to physical lab positions for automated quiz variant assignment';
COMMENT ON COLUMN machine_registry.fingerprint_hash IS 'SHA-256 hash of composite fingerprint (GPU + Canvas + Screen). Deterministic - same hardware produces same hash.';
