-- Invite codes for joining servers
CREATE TABLE invite_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uses INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT 0, -- 0 = unlimited
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
