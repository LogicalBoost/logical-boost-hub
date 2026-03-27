-- ============================================================================
-- 017_client_deployment_fields.sql
-- Add deployment tracking columns to clients table for Vercel/GitHub integration
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE clients ADD COLUMN github_repo VARCHAR(200);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE clients ADD COLUMN vercel_project_id VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE clients ADD COLUMN vercel_url VARCHAR(200);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE clients ADD COLUMN custom_domain VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE clients ADD COLUMN domain_verified BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
