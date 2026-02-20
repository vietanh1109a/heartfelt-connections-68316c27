-- Helper function: get user_id from auth.users by email
-- Uses SECURITY DEFINER so edge functions with service role can call it
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_user_id uuid;
BEGIN
  SELECT id INTO found_user_id
  FROM auth.users
  WHERE lower(email) = lower(lookup_email)
  LIMIT 1;
  RETURN found_user_id;
END;
$$;