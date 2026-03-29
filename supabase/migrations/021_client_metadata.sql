-- 021_client_metadata.sql
-- Add metadata JSONB column to clients for extensible data (Trustpilot widgets, etc.)

ALTER TABLE clients ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
