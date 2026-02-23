
-- CTV Profiles - wallet & stats for each CTV
CREATE TABLE public.ctv_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  commission_rate numeric(4,2) NOT NULL DEFAULT 0.10,
  pending_balance integer NOT NULL DEFAULT 0,
  available_balance integer NOT NULL DEFAULT 0,
  total_sales integer NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  refund_count integer NOT NULL DEFAULT 0,
  bank_name text,
  bank_account text,
  bank_holder text,
  contact_info text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ctv_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CTV can view own profile" ON public.ctv_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "CTV can update own profile" ON public.ctv_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage CTV profiles" ON public.ctv_profiles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderator can view CTV profiles" ON public.ctv_profiles
  FOR SELECT USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE TRIGGER update_ctv_profiles_updated_at
  BEFORE UPDATE ON public.ctv_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CTV Listings - products posted by CTVs
CREATE TABLE public.ctv_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ctv_user_id uuid NOT NULL REFERENCES public.ctv_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'account',
  price integer NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending_review',
  total_sold integer NOT NULL DEFAULT 0,
  refund_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ctv_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CTV can manage own listings" ON public.ctv_listings
  FOR ALL USING (auth.uid() = ctv_user_id);

CREATE POLICY "Admin can manage all listings" ON public.ctv_listings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderator can manage listings" ON public.ctv_listings
  FOR ALL USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Anyone can view approved listings" ON public.ctv_listings
  FOR SELECT USING (status = 'approved');

CREATE TRIGGER update_ctv_listings_updated_at
  BEFORE UPDATE ON public.ctv_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CTV Listing Items - credentials/stock for each listing
CREATE TABLE public.ctv_listing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ctv_listings(id) ON DELETE CASCADE,
  ctv_user_id uuid NOT NULL,
  content text NOT NULL,
  expiry_date timestamp with time zone,
  is_sold boolean NOT NULL DEFAULT false,
  sold_to uuid,
  sold_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ctv_listing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CTV can manage own listing items" ON public.ctv_listing_items
  FOR ALL USING (auth.uid() = ctv_user_id);

CREATE POLICY "Admin can manage all listing items" ON public.ctv_listing_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Buyers can view purchased items" ON public.ctv_listing_items
  FOR SELECT USING (auth.uid() = sold_to);

-- CTV Orders - when a buyer purchases from a CTV listing
CREATE TABLE public.ctv_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ctv_listings(id),
  listing_item_id uuid REFERENCES public.ctv_listing_items(id),
  ctv_user_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  price integer NOT NULL,
  platform_fee integer NOT NULL DEFAULT 0,
  ctv_earning integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'paid',
  earnings_released boolean NOT NULL DEFAULT false,
  release_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ctv_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CTV can view own orders" ON public.ctv_orders
  FOR SELECT USING (auth.uid() = ctv_user_id);

CREATE POLICY "Buyer can view own orders" ON public.ctv_orders
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Admin can manage all orders" ON public.ctv_orders
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderator can view orders" ON public.ctv_orders
  FOR SELECT USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE TRIGGER update_ctv_orders_updated_at
  BEFORE UPDATE ON public.ctv_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CTV Payout Requests
CREATE TABLE public.ctv_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ctv_user_id uuid NOT NULL REFERENCES public.ctv_profiles(user_id),
  amount integer NOT NULL,
  bank_name text NOT NULL,
  bank_account text NOT NULL,
  bank_holder text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamp with time zone,
  processed_by uuid,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ctv_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CTV can view own payouts" ON public.ctv_payout_requests
  FOR SELECT USING (auth.uid() = ctv_user_id);

CREATE POLICY "CTV can create own payouts" ON public.ctv_payout_requests
  FOR INSERT WITH CHECK (auth.uid() = ctv_user_id);

CREATE POLICY "Admin can manage all payouts" ON public.ctv_payout_requests
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ctv_payout_requests_updated_at
  BEFORE UPDATE ON public.ctv_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
