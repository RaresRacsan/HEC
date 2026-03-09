-- Drop the global unique constraint on channel name
-- and replace it with a partial unique constraint:
-- - For server channels: unique (server_id, name)
-- - For DMs: unique (name) still (they already use deterministic names like dm-1-2)

ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_name_unique;

-- Add composite unique for server-scoped channels (same name allowed in different servers)
CREATE UNIQUE INDEX IF NOT EXISTS channels_server_name_unique ON channels (server_id, name) WHERE server_id IS NOT NULL;

-- Add unique for DM channels (unique global name since they're user-pair deterministic)
CREATE UNIQUE INDEX IF NOT EXISTS channels_dm_name_unique ON channels (name) WHERE server_id IS NULL;
