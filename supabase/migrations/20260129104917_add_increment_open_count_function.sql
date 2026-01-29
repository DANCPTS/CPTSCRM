/*
  # Add function to increment email open count

  1. New Functions
    - `increment_recipient_open_count` - Increments open_count and sets opened_at on first open

  2. Security
    - Function is SECURITY DEFINER to allow edge function to call it
*/

CREATE OR REPLACE FUNCTION increment_recipient_open_count(recipient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE campaign_recipients
  SET 
    open_count = open_count + 1,
    opened_at = COALESCE(opened_at, now())
  WHERE id = recipient_id;
END;
$$;