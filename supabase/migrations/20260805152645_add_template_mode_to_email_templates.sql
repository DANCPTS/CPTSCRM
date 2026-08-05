/*
# Add template_mode column to email_templates

1. Modified Tables
   - `email_templates`
     - Added `template_mode` (text, NOT NULL, default 'standard')
       - 'standard': templates that use the CRM's built-in email layout with header/footer
       - 'standalone_html': complete HTML email documents imported from a URL or file
       - CHECK constraint limits values to these two options

2. Important Notes
   - Existing templates default to 'standard' and continue working as before.
   - Imported HTML templates will be saved as 'standalone_html' and bypass the standard wrapper.
*/

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS template_mode text NOT NULL DEFAULT 'standard';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_template_mode_check'
  ) THEN
    ALTER TABLE email_templates
      ADD CONSTRAINT email_templates_template_mode_check
      CHECK (template_mode IN ('standard', 'standalone_html'));
  END IF;
END $$;
