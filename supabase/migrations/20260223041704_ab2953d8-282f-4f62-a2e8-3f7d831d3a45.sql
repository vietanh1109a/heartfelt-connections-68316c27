
-- Fix OTP policies - restrict INSERT and UPDATE to service role only
DROP POLICY IF EXISTS "OTP insert" ON public.otp_codes;
DROP POLICY IF EXISTS "OTP update" ON public.otp_codes;

CREATE POLICY "OTP insert by service" ON public.otp_codes FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "OTP update by service" ON public.otp_codes FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
