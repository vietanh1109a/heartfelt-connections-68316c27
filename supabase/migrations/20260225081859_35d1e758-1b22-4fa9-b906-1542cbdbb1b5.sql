
-- ═══════════════════════════════════════════
-- ENUM
-- ═══════════════════════════════════════════
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.transaction_type AS ENUM (
  'deposit','purchase','cookie_view','vip_purchase','plan_purchase',
  'admin_add','admin_deduct','bonus','refund','product_purchase','ctv_purchase'
);

-- ═══════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  balance numeric NOT NULL DEFAULT 0,
  bonus_balance numeric NOT NULL DEFAULT 0,
  bonus_expires_at timestamptz,
  free_views_left int NOT NULL DEFAULT 3,
  vip_views_left int NOT NULL DEFAULT 0,
  vip_expires_at timestamptz,
  switch_count int NOT NULL DEFAULT 0,
  switch_reset_at timestamptz,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service insert profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Anyone can read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- app_settings
CREATE TABLE public.app_settings (
  id text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.app_settings (id, value) VALUES
  ('link_telegram', ''),
  ('link_extension', ''),
  ('link_instagram', ''),
  ('link_facebook', ''),
  ('link_tiktok', ''),
  ('link_threads', ''),
  ('link_support', ''),
  ('link_guide_youtube', ''),
  ('sepay_account_number', ''),
  ('bank_code', ''),
  ('account_name', ''),
  ('min_deposit_vnd', '10000'),
  ('warranty_days', '30');

-- moderator_permissions
CREATE TABLE public.moderator_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderator_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read mod perms" ON public.moderator_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage mod perms" ON public.moderator_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- admin_audit_logs
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id text NOT NULL,
  target_user_id text,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert audit logs" ON public.admin_audit_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- ═══════════════════════════════════════════
-- COOKIE / NETFLIX
-- ═══════════════════════════════════════════

CREATE TABLE public.cookie_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cookie_data text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
ALTER TABLE public.cookie_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage cookies" ON public.cookie_stock FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TABLE public.cookie_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cookie_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users create own reports" ON public.cookie_reports FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users read own reports" ON public.cookie_reports FOR SELECT TO authenticated USING (auth.uid()::text = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Admins manage reports" ON public.cookie_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TABLE public.netflix_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  duration_months int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.netflix_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read plans" ON public.netflix_plans FOR SELECT USING (true);
CREATE POLICY "Admins manage plans" ON public.netflix_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.netflix_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password text NOT NULL,
  plan_id uuid REFERENCES public.netflix_plans(id),
  is_assigned boolean NOT NULL DEFAULT false,
  assigned_to text,
  assigned_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.netflix_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage accounts" ON public.netflix_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Users read assigned" ON public.netflix_accounts FOR SELECT TO authenticated USING (auth.uid()::text = assigned_to);

-- ═══════════════════════════════════════════
-- TRANSACTIONS / DEPOSITS
-- ═══════════════════════════════════════════

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  type public.transaction_type NOT NULL,
  amount numeric NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own txns" ON public.transactions FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Service insert txns" ON public.transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  amount numeric NOT NULL,
  deposit_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  confirmed_at timestamptz,
  expires_at timestamptz,
  sepay_tx_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own deposits" ON public.deposits FOR SELECT TO authenticated USING (auth.uid()::text = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create deposits" ON public.deposits FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Admins manage deposits" ON public.deposits FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════
-- VIP
-- ═══════════════════════════════════════════

CREATE TABLE public.vip_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  duration_days int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vip_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read vip plans" ON public.vip_plans FOR SELECT USING (true);
CREATE POLICY "Admins manage vip" ON public.vip_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.plan_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.netflix_plans(id),
  account_id uuid REFERENCES public.netflix_accounts(id),
  amount_paid numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own purchases" ON public.plan_purchases FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Service insert purchases" ON public.plan_purchases FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════
-- PRODUCTS
-- ═══════════════════════════════════════════

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  note text,
  category text NOT NULL DEFAULT 'netflix',
  product_type text NOT NULL DEFAULT 'account',
  platform text,
  price numeric NOT NULL DEFAULT 0,
  original_price numeric,
  thumbnail_url text,
  is_active boolean NOT NULL DEFAULT true,
  sold_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read active products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TABLE public.product_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  content text NOT NULL,
  is_sold boolean NOT NULL DEFAULT false,
  sold_to text,
  sold_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage items" ON public.product_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Anyone read stock count" ON public.product_items FOR SELECT USING (true);

CREATE TABLE public.product_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_item_id uuid NOT NULL REFERENCES public.product_items(id),
  amount_paid numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own product purchases" ON public.product_purchases FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Service insert product purchases" ON public.product_purchases FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════
-- OTP
-- ═══════════════════════════════════════════

CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manage otp" ON public.otp_codes FOR ALL USING (true);

-- ═══════════════════════════════════════════
-- CTV (Cộng tác viên)
-- ═══════════════════════════════════════════

CREATE TABLE public.ctv_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  contact_info text NOT NULL,
  bank_info text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ctv_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reg" ON public.ctv_registrations FOR SELECT TO authenticated USING (auth.uid()::text = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Users create own reg" ON public.ctv_registrations FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Admins manage regs" ON public.ctv_registrations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TABLE public.ctv_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  phone text,
  fb_link text,
  zalo text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  commission_rate int NOT NULL DEFAULT 10,
  balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_withdrawn numeric NOT NULL DEFAULT 0,
  approved_at timestamptz,
  approved_by text,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ctv_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own ctv profile" ON public.ctv_profiles FOR SELECT TO authenticated USING (auth.uid()::text = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Users create own ctv" ON public.ctv_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Admins manage ctv" ON public.ctv_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Admins delete ctv" ON public.ctv_profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ctv_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ctv_user_id text NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'netflix',
  product_type text NOT NULL DEFAULT 'account',
  platform text,
  price numeric NOT NULL,
  thumbnail_url text,
  warranty_hours int NOT NULL DEFAULT 24,
  status text NOT NULL DEFAULT 'pending_review',
  total_sold int NOT NULL DEFAULT 0,
  refund_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ctv_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read approved listings" ON public.ctv_listings FOR SELECT USING (status = 'approved' OR auth.uid()::text = ctv_user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "CTV create listings" ON public.ctv_listings FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = ctv_user_id);
CREATE POLICY "CTV update own" ON public.ctv_listings FOR UPDATE TO authenticated USING (auth.uid()::text = ctv_user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TABLE public.ctv_listing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ctv_listings(id),
  ctv_user_id text NOT NULL,
  content text NOT NULL,
  is_sold boolean NOT NULL DEFAULT false,
  sold_to text,
  sold_at timestamptz,
  expiry_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ctv_listing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CTV manage own items" ON public.ctv_listing_items FOR ALL TO authenticated USING (auth.uid()::text = ctv_user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Anyone read listing items" ON public.ctv_listing_items FOR SELECT USING (true);

CREATE TABLE public.ctv_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.ctv_listings(id),
  item_id uuid REFERENCES public.ctv_listing_items(id),
  buyer_user_id text NOT NULL,
  ctv_user_id text NOT NULL,
  amount numeric NOT NULL,
  commission numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ctv_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own orders" ON public.ctv_orders FOR SELECT TO authenticated USING (auth.uid()::text = buyer_user_id OR auth.uid()::text = ctv_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service insert orders" ON public.ctv_orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.ctv_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ctv_user_id text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  note text,
  processed_at timestamptz,
  processed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ctv_payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CTV read own payouts" ON public.ctv_payout_requests FOR SELECT TO authenticated USING (auth.uid()::text = ctv_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CTV create payouts" ON public.ctv_payout_requests FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = ctv_user_id);
CREATE POLICY "Admins manage payouts" ON public.ctv_payout_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_user_id uuid, p_amount numeric, p_description text DEFAULT '')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET balance = balance + p_amount, updated_at = now() WHERE user_id = p_user_id;
END;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, is_verified)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), false);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('ctv-images', 'ctv-images', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can read product images" ON storage.objects FOR SELECT USING (bucket_id IN ('product-images', 'ctv-images'));
CREATE POLICY "Authenticated upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('product-images', 'ctv-images'));
