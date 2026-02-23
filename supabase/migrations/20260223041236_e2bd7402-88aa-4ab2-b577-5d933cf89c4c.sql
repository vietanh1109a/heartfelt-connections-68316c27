
-- Recreate all missing tables from original project

-- transaction_type enum
CREATE TYPE public.transaction_type AS ENUM ('deposit', 'usage');

-- profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  bonus_balance INTEGER NOT NULL DEFAULT 0,
  bonus_expires_at TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  switch_count INTEGER NOT NULL DEFAULT 0,
  switch_reset_at TIMESTAMP WITH TIME ZONE,
  vip_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- app_settings
CREATE TABLE public.app_settings (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- cookie_stock
CREATE TABLE public.cookie_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cookie_data TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by TEXT
);
ALTER TABLE public.cookie_stock ENABLE ROW LEVEL SECURITY;

-- cookie_reports
CREATE TABLE public.cookie_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.cookie_reports ENABLE ROW LEVEL SECURITY;

-- moderator_permissions
CREATE TABLE public.moderator_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tab TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.moderator_permissions ENABLE ROW LEVEL SECURITY;

-- netflix_plans
CREATE TABLE public.netflix_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  duration_months INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.netflix_plans ENABLE ROW LEVEL SECURITY;

-- netflix_accounts
CREATE TABLE public.netflix_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  plan_id UUID REFERENCES public.netflix_plans(id),
  is_assigned BOOLEAN NOT NULL DEFAULT false,
  assigned_to UUID,
  assigned_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.netflix_accounts ENABLE ROW LEVEL SECURITY;

-- otp_codes
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- transactions
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- plan_purchases
CREATE TABLE public.plan_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.netflix_plans(id),
  account_id UUID REFERENCES public.netflix_accounts(id),
  amount_paid INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_purchases ENABLE ROW LEVEL SECURITY;

-- referral_logs
CREATE TABLE public.referral_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  bonus_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_logs ENABLE ROW LEVEL SECURITY;

-- user_bans
CREATE TABLE public.user_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- user_cookie_assignment
CREATE TABLE public.user_cookie_assignment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cookie_id UUID NOT NULL REFERENCES public.cookie_stock(id),
  slot INTEGER NOT NULL DEFAULT 1,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.user_cookie_assignment ENABLE ROW LEVEL SECURITY;

-- vip_plans
CREATE TABLE public.vip_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.vip_plans ENABLE ROW LEVEL SECURITY;

-- vip_purchases
CREATE TABLE public.vip_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vip_plan_id UUID REFERENCES public.vip_plans(id),
  amount_paid INTEGER NOT NULL,
  vip_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  granted_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.vip_purchases ENABLE ROW LEVEL SECURITY;

-- admin_audit_logs
CREATE TABLE public.admin_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_user_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- ═══ RLS Policies ═══

-- profiles
CREATE OR REPLACE FUNCTION public.is_owner_profile(profile_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = profile_user_id
$$;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can manage profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderator can view profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'moderator'));

-- app_settings
CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage settings" ON public.app_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- cookie_stock
CREATE POLICY "Admin can manage cookies" ON public.cookie_stock FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderator can manage cookies" ON public.cookie_stock FOR ALL USING (public.has_role(auth.uid(), 'moderator'));

-- cookie_reports
CREATE POLICY "Users can create reports" ON public.cookie_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own reports" ON public.cookie_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage reports" ON public.cookie_reports FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderator can manage reports" ON public.cookie_reports FOR ALL USING (public.has_role(auth.uid(), 'moderator'));

-- moderator_permissions
CREATE POLICY "Anyone can read mod perms" ON public.moderator_permissions FOR SELECT USING (true);
CREATE POLICY "Admin can manage mod perms" ON public.moderator_permissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- netflix_plans
CREATE POLICY "Anyone can view active plans" ON public.netflix_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage plans" ON public.netflix_plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- netflix_accounts
CREATE POLICY "Admin can manage accounts" ON public.netflix_accounts FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderator can manage accounts" ON public.netflix_accounts FOR ALL USING (public.has_role(auth.uid(), 'moderator'));

-- transactions
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage transactions" ON public.transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderator can view transactions" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'moderator'));

-- plan_purchases
CREATE POLICY "Users can view own plan purchases" ON public.plan_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage plan purchases" ON public.plan_purchases FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- user_bans
CREATE POLICY "Users can view own bans" ON public.user_bans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage bans" ON public.user_bans FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderator can view bans" ON public.user_bans FOR SELECT USING (public.has_role(auth.uid(), 'moderator'));

-- user_cookie_assignment
CREATE POLICY "Users can view own assignments" ON public.user_cookie_assignment FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage assignments" ON public.user_cookie_assignment FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- vip_plans
CREATE POLICY "Anyone can view active vip plans" ON public.vip_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage vip plans" ON public.vip_plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- vip_purchases
CREATE POLICY "Users can view own vip purchases" ON public.vip_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage vip purchases" ON public.vip_purchases FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- admin_audit_logs
CREATE POLICY "Admin can manage audit logs" ON public.admin_audit_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- otp_codes
CREATE POLICY "OTP select" ON public.otp_codes FOR SELECT USING (true);
CREATE POLICY "OTP insert" ON public.otp_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "OTP update" ON public.otp_codes FOR UPDATE USING (true);

-- referral_logs
CREATE POLICY "Users can view own referrals" ON public.referral_logs FOR SELECT USING (auth.uid() = referrer_user_id);
CREATE POLICY "Admin can manage referrals" ON public.referral_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ═══ DB Functions ═══

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(target_user_id UUID, delta INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_balance INTEGER;
BEGIN
  UPDATE profiles SET balance = balance + delta WHERE user_id = target_user_id RETURNING balance INTO new_balance;
  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_balance(target_user_id UUID, delta INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET balance = balance + delta WHERE user_id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_bonus_balance(target_user_id UUID, delta INTEGER, expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET bonus_balance = bonus_balance + delta, bonus_expires_at = COALESCE(expires_at, bonus_expires_at) WHERE user_id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_effective_balance(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE bal INTEGER; bonus INTEGER; expires TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT balance, bonus_balance, bonus_expires_at INTO bal, bonus, expires FROM profiles WHERE user_id = target_user_id;
  IF expires IS NOT NULL AND expires > now() THEN
    RETURN bal + bonus;
  END IF;
  RETURN bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_bonus_if_needed(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET bonus_balance = 0 WHERE user_id = target_user_id AND bonus_expires_at IS NOT NULL AND bonus_expires_at <= now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(lookup_email TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = lookup_email LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_sufficient_balance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT balance FROM profiles WHERE user_id = auth.uid()), 0) >= 500;
$$;

CREATE OR REPLACE FUNCTION public.assign_cookies_to_user(target_user_id UUID, desired_count INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- placeholder
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_netflix_stock_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM netflix_accounts WHERE is_assigned = false;
$$;

CREATE OR REPLACE FUNCTION public.get_netflix_stock_by_plan()
RETURNS TABLE(plan_id UUID, count INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plan_id, COUNT(*)::INTEGER as count FROM netflix_accounts WHERE is_assigned = false GROUP BY plan_id;
$$;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
