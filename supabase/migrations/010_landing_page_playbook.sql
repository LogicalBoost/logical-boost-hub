-- Add landing page playbook and concepts columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS landing_page_playbook jsonb DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS landing_page_concepts jsonb DEFAULT NULL;
