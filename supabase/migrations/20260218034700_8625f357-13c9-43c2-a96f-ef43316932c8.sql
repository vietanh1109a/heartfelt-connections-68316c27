
-- 1. Thêm cột switch_count và switch_reset_at vào profiles để track lượt đổi cookie
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS switch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS switch_reset_at timestamp with time zone;

-- 2. Tạo bảng referral_logs để track mã giới thiệu
CREATE TABLE IF NOT EXISTS public.referral_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  bonus_amount integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view referral logs"
  ON public.referral_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own referral logs"
  ON public.referral_logs FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- 3. Tạo trigger assign_initial_cookies cho user mới
CREATE OR REPLACE FUNCTION public.on_new_profile_assign_cookies()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Gán 2 cookie ngẫu nhiên cho user mới (Free)
  PERFORM public.assign_cookies_to_user(NEW.user_id, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_cookies_on_profile_create ON public.profiles;
CREATE TRIGGER assign_cookies_on_profile_create
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_profile_assign_cookies();

-- 4. RLS policy cho referral_logs insert (edge function dùng service role)
-- Chỉ service role mới insert được

-- 5. Tạo index cho referral_logs
CREATE INDEX IF NOT EXISTS idx_referral_logs_referrer ON public.referral_logs(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_logs_referred ON public.referral_logs(referred_user_id);
