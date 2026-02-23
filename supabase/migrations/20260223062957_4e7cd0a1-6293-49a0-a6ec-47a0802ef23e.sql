
-- Add missing columns to deposits
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS sepay_tx_id text;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;

-- Create webhook_events table for idempotency
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can manage webhook events"
  ON public.webhook_events FOR ALL
  USING (false);
