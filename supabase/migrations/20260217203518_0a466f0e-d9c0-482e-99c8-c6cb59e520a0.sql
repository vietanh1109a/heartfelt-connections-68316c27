-- Function to check available Netflix account stock (no RLS needed)
CREATE OR REPLACE FUNCTION public.get_netflix_stock_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.netflix_accounts WHERE is_assigned = false;
$$;