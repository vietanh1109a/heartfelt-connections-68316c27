
-- Add original_price column to products
ALTER TABLE public.products ADD COLUMN original_price integer DEFAULT NULL;

-- Add warranty_days setting
INSERT INTO public.app_settings (id, value, description)
VALUES ('warranty_days', '30', 'Số ngày bảo hành sản phẩm')
ON CONFLICT (id) DO NOTHING;
