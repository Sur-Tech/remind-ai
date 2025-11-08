-- Add unique constraint for upsert operations
ALTER TABLE calendar_connections 
ADD CONSTRAINT calendar_connections_user_provider_unique 
UNIQUE (user_id, provider);