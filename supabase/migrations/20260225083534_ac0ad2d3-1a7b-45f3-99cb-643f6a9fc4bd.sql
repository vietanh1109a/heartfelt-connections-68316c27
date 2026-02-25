
-- Create user_bans table
CREATE TABLE public.user_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reason TEXT,
  banned_by UUID,
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage bans" ON public.user_bans FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own bans" ON public.user_bans FOR SELECT USING (auth.uid() = user_id);

-- Create vip_purchases table
CREATE TABLE public.vip_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID REFERENCES public.vip_plans(id),
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vip_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage vip_purchases" ON public.vip_purchases FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own vip_purchases" ON public.vip_purchases FOR SELECT USING (auth.uid() = user_id);

-- Create user_cookie_assignment table
CREATE TABLE public.user_cookie_assignment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cookie_id UUID REFERENCES public.cookie_stock(id),
  slot INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_cookie_assignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage cookie assignments" ON public.user_cookie_assignment FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own assignments" ON public.user_cookie_assignment FOR SELECT USING (auth.uid() = user_id);
