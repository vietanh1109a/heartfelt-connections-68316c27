
-- Table to store CTV (collaborator) registrations
CREATE TABLE public.ctv_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  contact_info text NOT NULL,
  bank_info text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ctv_registrations ENABLE ROW LEVEL SECURITY;

-- Users can insert their own registration
CREATE POLICY "Users can register as CTV"
ON public.ctv_registrations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own registration
CREATE POLICY "Users can view own CTV registration"
ON public.ctv_registrations
FOR SELECT
USING (auth.uid() = user_id);

-- Admin can manage all registrations
CREATE POLICY "Admin can manage CTV registrations"
ON public.ctv_registrations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Moderator can view registrations
CREATE POLICY "Moderator can view CTV registrations"
ON public.ctv_registrations
FOR SELECT
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_ctv_registrations_updated_at
BEFORE UPDATE ON public.ctv_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
