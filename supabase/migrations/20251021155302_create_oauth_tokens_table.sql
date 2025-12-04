/*
  # Create OAuth Tokens Table

  1. New Tables
    - `oauth_tokens`
      - `id` (uuid, primary key) - Unique identifier for each token record
      - `user_id` (uuid, foreign key) - References auth.users, the user who owns this token
      - `provider` (text) - OAuth provider name (e.g., 'google')
      - `access_token` (text) - OAuth access token for API calls
      - `refresh_token` (text) - OAuth refresh token to renew access
      - `expires_at` (timestamptz) - When the access token expires
      - `scope` (text) - Granted OAuth scopes
      - `created_at` (timestamptz) - When this record was created
      - `updated_at` (timestamptz) - When this record was last updated

  2. Security
    - Enable RLS on `oauth_tokens` table
    - Add policy for users to read their own tokens
    - Add policy for users to insert their own tokens
    - Add policy for users to update their own tokens
    - Add policy for users to delete their own tokens

  3. Important Notes
    - Tokens are sensitive and should only be accessible by the owning user
    - The table uses cascading delete to clean up tokens when users are deleted
    - Created_at and updated_at timestamps track token lifecycle
*/

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scope text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own oauth tokens"
  ON oauth_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own oauth tokens"
  ON oauth_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own oauth tokens"
  ON oauth_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own oauth tokens"
  ON oauth_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);