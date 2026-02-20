
-- FIX: Atomic increment_balance RPC to prevent race conditions in verify-otp
CREATE OR REPLACE FUNCTION public.increment_balance(target_user_id uuid, delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET balance = balance + delta
  WHERE user_id = target_user_id;
END;
$$;

-- FIX: Admin adjust balance atomically (prevents stale data overwrite)
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(target_user_id uuid, delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE public.profiles
  SET balance = balance + delta
  WHERE user_id = target_user_id
  RETURNING balance INTO new_balance;
  
  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Số dư không thể âm';
  END IF;
  
  RETURN new_balance;
END;
$$;

-- FIX Ghost Ban: Ensure is_permanent=false with null expires_at never accidentally bans forever
-- Add a DB check constraint via trigger instead of CHECK (avoids immutable function issues)
CREATE OR REPLACE FUNCTION public.validate_user_ban()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If not permanent AND expires_at is null, reject the ban
  IF NEW.is_permanent = false AND NEW.expires_at IS NULL THEN
    RAISE EXCEPTION 'Ban không vĩnh viễn phải có expires_at. Dùng is_permanent=true để ban vĩnh viễn.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_ban_before_insert ON public.user_bans;
CREATE TRIGGER validate_ban_before_insert
BEFORE INSERT OR UPDATE ON public.user_bans
FOR EACH ROW EXECUTE FUNCTION public.validate_user_ban();
