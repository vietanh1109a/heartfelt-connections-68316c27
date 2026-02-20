
-- 1. Tạo bảng user_cookie_assignment
CREATE TABLE IF NOT EXISTS public.user_cookie_assignment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cookie_id UUID NOT NULL REFERENCES public.cookie_stock(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  slot INTEGER NOT NULL DEFAULT 1, -- 1,2 cho Free; 1..5 cho VIP
  UNIQUE (user_id, cookie_id)
);

ALTER TABLE public.user_cookie_assignment ENABLE ROW LEVEL SECURITY;

-- RLS: user chỉ thấy cookie của mình, admin thấy hết
CREATE POLICY "Users can view own cookie assignments"
  ON public.user_cookie_assignment FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage cookie assignments"
  ON public.user_cookie_assignment FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Function: gán ngẫu nhiên N cookie active cho user (nếu chưa đủ)
CREATE OR REPLACE FUNCTION public.assign_cookies_to_user(target_user_id UUID, desired_count INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  needed INTEGER;
BEGIN
  -- Đếm số cookie đang được gán
  SELECT COUNT(*) INTO current_count
  FROM public.user_cookie_assignment uca
  JOIN public.cookie_stock cs ON cs.id = uca.cookie_id
  WHERE uca.user_id = target_user_id AND cs.is_active = true;

  needed := desired_count - current_count;
  IF needed <= 0 THEN RETURN; END IF;

  -- Gán thêm cookie ngẫu nhiên chưa được dùng bởi user này
  INSERT INTO public.user_cookie_assignment (user_id, cookie_id, slot)
  SELECT
    target_user_id,
    cs.id,
    current_count + ROW_NUMBER() OVER ()
  FROM public.cookie_stock cs
  WHERE cs.is_active = true
    AND cs.id NOT IN (
      SELECT cookie_id FROM public.user_cookie_assignment WHERE user_id = target_user_id
    )
  ORDER BY RANDOM()
  LIMIT needed
  ON CONFLICT (user_id, cookie_id) DO NOTHING;
END;
$$;

-- 3. Function gọi khi user mới tạo (trigger on auth.users)
-- Trigger sẽ được gọi từ handle_new_user đã có hoặc ta tạo trigger mới
CREATE OR REPLACE FUNCTION public.assign_initial_cookies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Gán 2 cookie ngẫu nhiên cho user mới
  PERFORM public.assign_cookies_to_user(NEW.user_id, 2);
  RETURN NEW;
END;
$$;

-- Trigger: chạy sau khi profile mới được tạo (profile được tạo cùng lúc user đăng ký)
CREATE OR REPLACE TRIGGER trigger_assign_initial_cookies
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_initial_cookies();
