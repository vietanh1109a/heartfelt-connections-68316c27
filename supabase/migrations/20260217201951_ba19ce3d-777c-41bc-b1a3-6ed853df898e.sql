
-- Netflix plans table
CREATE TABLE public.netflix_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  price INTEGER NOT NULL, -- price in $ (credits)
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.netflix_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans
CREATE POLICY "Anyone can view active plans"
  ON public.netflix_plans FOR SELECT
  USING (is_active = true);

-- Admins can manage plans
CREATE POLICY "Admins can manage plans"
  ON public.netflix_plans FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Netflix accounts table (admin assigns accounts to purchased plans)
CREATE TABLE public.netflix_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES public.netflix_plans(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  is_assigned BOOLEAN NOT NULL DEFAULT false,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.netflix_accounts ENABLE ROW LEVEL SECURITY;

-- Users can see their own assigned accounts
CREATE POLICY "Users can view own assigned accounts"
  ON public.netflix_accounts FOR SELECT
  USING (assigned_to = auth.uid());

-- Admins can manage all accounts
CREATE POLICY "Admins can manage accounts"
  ON public.netflix_accounts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Plan purchases table
CREATE TABLE public.plan_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  plan_id UUID NOT NULL REFERENCES public.netflix_plans(id),
  account_id UUID REFERENCES public.netflix_accounts(id),
  amount_paid INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, assigned, expired
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view own purchases
CREATE POLICY "Users can view own purchases"
  ON public.plan_purchases FOR SELECT
  USING (user_id = auth.uid());

-- Users can create purchases
CREATE POLICY "Users can create purchases"
  ON public.plan_purchases FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can manage all purchases
CREATE POLICY "Admins can manage purchases"
  ON public.plan_purchases FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_netflix_plans_updated_at
  BEFORE UPDATE ON public.netflix_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_netflix_accounts_updated_at
  BEFORE UPDATE ON public.netflix_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_purchases_updated_at
  BEFORE UPDATE ON public.plan_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default plans
INSERT INTO public.netflix_plans (name, duration_months, price, description) VALUES
  ('Netflix 1 Tháng', 1, 50, 'Tài khoản Netflix Premium 1 tháng'),
  ('Netflix 3 Tháng', 3, 130, 'Tài khoản Netflix Premium 3 tháng - Tiết kiệm 13%'),
  ('Netflix 6 Tháng', 6, 240, 'Tài khoản Netflix Premium 6 tháng - Tiết kiệm 20%'),
  ('Netflix 1 Năm', 12, 450, 'Tài khoản Netflix Premium 1 năm - Tiết kiệm 25%');
