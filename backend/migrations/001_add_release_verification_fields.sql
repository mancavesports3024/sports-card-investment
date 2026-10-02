-- Migration: Add verification tracking fields to releases table
-- Date: 2026-09-29
-- Author: Automated improvement
-- Description: Add source tracking and date verification metadata

-- Add new columns for source verification tracking
ALTER TABLE releases ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS date_status VARCHAR(20) DEFAULT 'estimated';
ALTER TABLE releases ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS last_verified_by VARCHAR(100) DEFAULT 'system';
ALTER TABLE releases ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_date_status ON releases(date_status);
CREATE INDEX IF NOT EXISTS idx_last_verified_at ON releases(last_verified_at);

-- Add comments for documentation
COMMENT ON COLUMN releases.source_url IS 'URL to the source where the release date was verified';
COMMENT ON COLUMN releases.date_status IS 'Confidence level: confirmed (manufacturer verified), estimated (reliable aggregator), tbd (no date set)';
COMMENT ON COLUMN releases.last_verified_at IS 'Timestamp when this release was last manually verified';
COMMENT ON COLUMN releases.last_verified_by IS 'Email or username of person who verified this release';
COMMENT ON COLUMN releases.verification_notes IS 'Optional notes about the verification source or process';
