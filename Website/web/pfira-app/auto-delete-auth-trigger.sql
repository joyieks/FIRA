-- DISABLED: Automatic Auth User Deletion Trigger
-- This approach doesn't work reliably due to permissions issues
-- Instead, use the application-level delete or manual cleanup

-- To remove the triggers that are causing issues, run this:

DROP TRIGGER IF EXISTS on_station_delete ON station_users;
DROP TRIGGER IF EXISTS on_responder_delete ON responders;
DROP FUNCTION IF EXISTS delete_station_auth_user();
DROP FUNCTION IF EXISTS delete_responder_auth_user();

-- Note: Use the application code (handleDelete function) to delete both
-- the station/responder record AND the auth user programmatically
