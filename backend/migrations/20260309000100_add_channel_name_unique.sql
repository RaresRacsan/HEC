-- Add unique constraint on channels.name so we can use ON CONFLICT for DM upserts
ALTER TABLE channels ADD CONSTRAINT channels_name_unique UNIQUE (name);
