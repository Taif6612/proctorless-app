-- ============================================
-- MACHINE REGISTRY SETUP
-- ============================================
-- Run this SQL in Supabase SQL Editor to create the machine_registry table
-- for fingerprint-based machine identification.
--
-- This enables:
-- 1. Storing machine fingerprints (GPU + Canvas + Screen hash)
-- 2. Mapping fingerprints to physical lab positions (row, col)
-- 3. Automatic variant assignment using Latin Square algorithm
-- ============================================

-- Drop existing table if needed (uncomment for fresh start)
-- DROP TABLE IF EXISTS machine_registry;

CREATE TABLE IF NOT EXISTS machine_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The SHA-256 hash of the composite fingerprint (GPU + Canvas + Screen)
  fingerprint_hash TEXT UNIQUE NOT NULL,
  
  -- Physical location mapping
  lab_name TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  column_index INTEGER NOT NULL,
  
  -- Optional human-readable label
  machine_label TEXT,
  
  -- Fingerprint components (for debugging)
  fingerprint_components JSONB,
  
  -- Metadata
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  registered_by UUID REFERENCES auth.users(id),
  last_seen_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  registration_notes TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Ensure unique position per lab
  UNIQUE(lab_name, row_index, column_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_machine_fingerprint ON machine_registry(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_machine_lab ON machine_registry(lab_name);
CREATE INDEX IF NOT EXISTS idx_machine_active ON machine_registry(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE machine_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can read machine registry" ON machine_registry;
CREATE POLICY "Anyone can read machine registry"
  ON machine_registry FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Professors can manage machine registry" ON machine_registry;
CREATE POLICY "Professors can manage machine registry"
  ON machine_registry FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('professor', 'admin')
    )
  );

-- Helper function to get variant
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
    ((m.row_index * 3) + m.column_index) % p_total_variants AS variant_index,
    m.machine_label
  FROM machine_registry m
  WHERE m.fingerprint_hash = p_fingerprint_hash
    AND m.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_variant_for_machine TO authenticated;

-- Comments
COMMENT ON TABLE machine_registry IS 'Maps machine fingerprints to physical lab positions for automated quiz variant assignment';
