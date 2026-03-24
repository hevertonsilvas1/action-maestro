
-- Allow support users to insert pix_batches (needed for batch generation)
CREATE POLICY "Support can insert batches"
ON public.pix_batches
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'support'::app_role));
