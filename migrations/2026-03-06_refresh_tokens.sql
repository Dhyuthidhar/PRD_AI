-- Create refresh tokens table for secure token rotation
-- This enables short-lived access tokens (15 min) with long-lived refresh tokens (7 days)

CREATE TABLE refresh_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id VARCHAR(255) UNIQUE NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_id ON refresh_tokens(token_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at);

-- Function to clean up expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM refresh_tokens 
  WHERE expires_at < NOW() 
  OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for secure token rotation';
COMMENT ON COLUMN refresh_tokens.token_id IS 'Unique identifier for the refresh token';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'Hashed version of the refresh token for security';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'When the refresh token expires';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'When the token was revoked (logout)';
COMMENT ON COLUMN refresh_tokens.last_used_at IS 'Last time this refresh token was used';
