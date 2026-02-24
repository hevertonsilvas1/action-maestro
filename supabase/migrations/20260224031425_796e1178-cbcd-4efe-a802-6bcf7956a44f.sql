
-- Add receipt tracking columns to winners
ALTER TABLE public.winners
  ADD COLUMN IF NOT EXISTS receipt_filename text,
  ADD COLUMN IF NOT EXISTS receipt_attached_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_attached_by text,
  ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_version integer NOT NULL DEFAULT 0;

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated users can upload receipts
CREATE POLICY "Authenticated can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- RLS: Authenticated users can read receipts
CREATE POLICY "Authenticated can read receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- RLS: Authenticated users can update receipts
CREATE POLICY "Authenticated can update receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts');

-- RLS: Authenticated users can delete receipts
CREATE POLICY "Authenticated can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');
