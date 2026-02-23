
CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  deposit_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage deposits"
  ON public.deposits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderator can view deposits"
  ON public.deposits FOR SELECT
  USING (public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Users can view own deposits"
  ON public.deposits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deposits"
  ON public.deposits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX idx_deposits_deposit_code ON public.deposits(deposit_code);
CREATE INDEX idx_deposits_status ON public.deposits(status);
