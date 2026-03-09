-- Add password_hash to users, nullable at first to migrate existing users, then set default for new ones
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) DEFAULT '';

-- Create Servers table
CREATE TABLE servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Associate Channels with Servers
ALTER TABLE channels ADD COLUMN server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE;
ALTER TABLE channels ADD COLUMN channel_type VARCHAR(50) DEFAULT 'text'; -- 'text' or 'voice'

-- Tracks which users belong to which servers
CREATE TABLE server_members (
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (server_id, user_id)
);
