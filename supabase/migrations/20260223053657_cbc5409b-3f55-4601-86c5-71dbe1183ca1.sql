
-- Add free_views_left and vip_views_left columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_views_left integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_views_left integer NOT NULL DEFAULT 0;
