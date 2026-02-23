
-- Allow users to insert their own CTV profile during registration
CREATE POLICY "Users can insert own CTV profile"
ON public.ctv_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);
