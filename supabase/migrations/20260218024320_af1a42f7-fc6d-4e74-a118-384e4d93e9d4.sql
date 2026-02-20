-- Add VIP expiry column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add VIP plan table for purchasable VIP subscriptions
CREATE TABLE IF NOT EXISTS public.vip_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on vip_plans
ALTER TABLE public.vip_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active vip plans"
ON public.vip_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage vip plans"
ON public.vip_plans FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add vip_purchases table
CREATE TABLE IF NOT EXISTS public.vip_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vip_plan_id UUID REFERENCES public.vip_plans(id),
  amount_paid INTEGER NOT NULL,
  granted_by UUID DEFAULT NULL,
  vip_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vip_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vip purchases"
ON public.vip_purchases FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage vip purchases"
ON public.vip_purchases FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for vip_plans updated_at
CREATE TRIGGER update_vip_plans_updated_at
BEFORE UPDATE ON public.vip_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default VIP plans
INSERT INTO public.vip_plans (name, description, price, duration_days)
VALUES
  ('VIP 1 tháng', 'Hiển thị badge VIP trong 30 ngày', 5, 30),
  ('VIP 3 tháng', 'Hiển thị badge VIP trong 90 ngày', 12, 90),
  ('VIP 6 tháng', 'Hiển thị badge VIP trong 180 ngày', 20, 180);
