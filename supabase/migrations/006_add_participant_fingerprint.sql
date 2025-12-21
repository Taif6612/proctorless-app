-- ============================================
-- Add machine_fingerprint to session_participants
-- ============================================
-- This allows tracking which machine a student used,
-- even if they were manually assigned a seat.

ALTER TABLE session_participants 
ADD COLUMN IF NOT EXISTS machine_fingerprint TEXT;

COMMENT ON COLUMN session_participants.machine_fingerprint IS 'SHA-256 hash of machine fingerprint used by student';

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_participant_fingerprint 
ON session_participants(machine_fingerprint) 
WHERE machine_fingerprint IS NOT NULL;
