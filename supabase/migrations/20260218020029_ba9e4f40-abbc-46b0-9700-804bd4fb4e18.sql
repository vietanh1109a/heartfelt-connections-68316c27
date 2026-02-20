
ALTER TABLE public.plan_purchases 
DROP CONSTRAINT plan_purchases_account_id_fkey;

ALTER TABLE public.plan_purchases 
ADD CONSTRAINT plan_purchases_account_id_fkey 
FOREIGN KEY (account_id) 
REFERENCES public.netflix_accounts(id) 
ON DELETE SET NULL;
