
-- Add new statuses to winner_status enum
ALTER TYPE public.winner_status ADD VALUE IF NOT EXISTS 'pix_refused';
ALTER TYPE public.winner_status ADD VALUE IF NOT EXISTS 'receipt_attached';

-- Add tracking columns for PIX request idempotency and audit
ALTER TABLE public.winners 
  ADD COLUMN IF NOT EXISTS last_pix_request_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_pix_error text,
  ADD COLUMN IF NOT EXISTS last_pix_requested_by text;
