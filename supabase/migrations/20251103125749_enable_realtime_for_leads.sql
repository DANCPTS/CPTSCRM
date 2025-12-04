/*
  # Enable real-time for leads table

  1. Changes
    - Enable real-time replication for the leads table
    - This allows the frontend to receive live updates when leads are updated

  2. Purpose
    - When a booking form is signed and the lead status changes to 'won'
    - The leads page will receive the update in real-time and trigger celebration animation
*/

-- Enable real-time for leads table
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
