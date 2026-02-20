-- Moderator permissions table: stores which tabs a moderator can view and edit
CREATE TABLE IF NOT EXISTS public.moderator_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab text NOT NULL UNIQUE,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed default tabs (all disabled by default for moderators)
INSERT INTO public.moderator_permissions (tab, can_view, can_edit) VALUES
  ('stats', false, false),
  ('users', false, false),
  ('cookies', false, false),
  ('netflix-accounts', false, false),
  ('transactions', false, false),
  ('deposits', false, false),
  ('vip-plans', false, false),
  ('moderators', false, false),
  ('settings', false, false)
ON CONFLICT (tab) DO NOTHING;

-- Enable RLS
ALTER TABLE public.moderator_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "Admins can manage moderator permissions"
  ON public.moderator_permissions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Moderators can view their permissions
CREATE POLICY "Moderators can view permissions"
  ON public.moderator_permissions
  FOR SELECT
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_moderator_permissions_updated_at
  BEFORE UPDATE ON public.moderator_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();