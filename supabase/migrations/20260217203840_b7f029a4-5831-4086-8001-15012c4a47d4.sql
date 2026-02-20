-- Function to get stock count per plan
CREATE OR REPLACE FUNCTION public.get_netflix_stock_by_plan()
RETURNS TABLE(plan_id uuid, count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT na.plan_id, COUNT(*)::integer as count
  FROM public.netflix_accounts na
  WHERE na.is_assigned = false AND na.plan_id IS NOT NULL
  GROUP BY na.plan_id;
$$;