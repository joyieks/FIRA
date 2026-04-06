-- Check all constraints on report_assignments table
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'report_assignments'::regclass
ORDER BY conname;

-- Also check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'report_assignments'
ORDER BY indexname;
