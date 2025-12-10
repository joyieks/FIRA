-- Add invalidation and validation columns to fire_reports table
-- Run this in your Supabase SQL Editor

ALTER TABLE fire_reports
ADD COLUMN IF NOT EXISTS invalidated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries on invalidated reports
CREATE INDEX IF NOT EXISTS idx_fire_reports_invalidated ON fire_reports(invalidated);
CREATE INDEX IF NOT EXISTS idx_fire_reports_validated ON fire_reports(validated);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'fire_reports'
AND column_name IN ('invalidated', 'invalidated_at', 'validated', 'validated_at')
ORDER BY column_name;
