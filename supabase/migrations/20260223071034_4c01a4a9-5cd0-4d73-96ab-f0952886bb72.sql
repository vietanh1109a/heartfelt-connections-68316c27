-- Allow users to view their own purchased product items
CREATE POLICY "Users can view own purchased items"
ON public.product_items
FOR SELECT
USING (auth.uid() = sold_to);