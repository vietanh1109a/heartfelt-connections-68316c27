
-- Add bonus_balance and bonus_expires_at columns to profiles
-- bonus_balance = free/referral balance with expiry
-- balance = permanent balance (deposits, admin grants)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_expires_at TIMESTAMP WITH TIME ZONE;

-- Migrate existing data: treat current balance as permanent balance
-- (we cannot distinguish historical data, so we leave bonus_balance = 0)

-- Add allowed_origin to app_settings for CORS control
INSERT INTO public.app_settings (id, value, description)
VALUES ('allowed_origin', '*', 'Domain được phép truy cập API (VD: https://yourapp.com). Dùng * để cho phép tất cả.')
ON CONFLICT (id) DO NOTHING;

-- Function: get effective (spendable) balance = permanent balance + non-expired bonus
CREATE OR REPLACE FUNCTION public.get_effective_balance(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  SELECT balance, bonus_balance, bonus_expires_at
  INTO p
  FROM public.profiles
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Bonus is only counted if not expired
  IF p.bonus_expires_at IS NOT NULL AND p.bonus_expires_at < now() THEN
    RETURN p.balance; -- bonus expired, only permanent balance
  END IF;

  RETURN p.balance + p.bonus_balance;
END;
$$;

-- Atomic increment for bonus balance (with expiry)
CREATE OR REPLACE FUNCTION public.increment_bonus_balance(
  target_user_id uuid,
  delta integer,
  expires_at timestamp with time zone DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    bonus_balance = bonus_balance + delta,
    bonus_expires_at = COALESCE(expires_at, bonus_expires_at)
  WHERE user_id = target_user_id;
END;
$$;

-- Function to expire bonus balances automatically (called by deduct-balance)
CREATE OR REPLACE FUNCTION public.expire_bonus_if_needed(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET bonus_balance = 0
  WHERE user_id = target_user_id
    AND bonus_expires_at IS NOT NULL
    AND bonus_expires_at < now()
    AND bonus_balance > 0;
END;
$$;
