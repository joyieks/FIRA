-- Drop the unique index that prevents multiple stations per report
-- This is preventing backup station assignments
DROP INDEX IF EXISTS uniq_report_station_per_report CASCADE;

-- Verify it's gone
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'report_assignments'
AND indexname = 'uniq_report_station_per_report';

-- Expected result: No rows (index removed)
