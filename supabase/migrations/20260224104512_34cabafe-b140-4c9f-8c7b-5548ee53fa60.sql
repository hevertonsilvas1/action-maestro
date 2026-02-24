
-- Add new winner statuses
ALTER TYPE public.winner_status ADD VALUE IF NOT EXISTS 'numero_inexistente';
ALTER TYPE public.winner_status ADD VALUE IF NOT EXISTS 'cliente_nao_responde';

-- Add payment_method enum
CREATE TYPE public.payment_method AS ENUM ('lote_pix', 'manual');

-- Create pix_batches table
CREATE TABLE public.pix_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid REFERENCES public.actions(id) NOT NULL,
  generated_by text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  winner_count integer NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pix_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read batches" ON public.pix_batches FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Admins can insert batches" ON public.pix_batches FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can delete batches" ON public.pix_batches FOR DELETE USING (is_admin());

-- Add batch_id and payment_method to winners
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.pix_batches(id);
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS payment_method public.payment_method;
