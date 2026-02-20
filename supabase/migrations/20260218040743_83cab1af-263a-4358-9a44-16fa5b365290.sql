-- Create app_settings table for admin configuration
CREATE TABLE public.app_settings (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write settings
CREATE POLICY "Admins can read settings"
  ON public.app_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default values
INSERT INTO public.app_settings (id, value, description) VALUES
  ('bank_id', 'MB', 'Mã ngân hàng (VD: MB, VCB, TCB...)'),
  ('account_no', '0123456789', 'Số tài khoản ngân hàng'),
  ('account_name', 'NGUYEN VAN A', 'Tên chủ tài khoản'),
  ('exchange_rate', '2', 'Tỷ giá: 1000 VND = X $'),
  ('min_deposit_vnd', '30000', 'Nạp tối thiểu (VND)');

-- Trigger to update updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();