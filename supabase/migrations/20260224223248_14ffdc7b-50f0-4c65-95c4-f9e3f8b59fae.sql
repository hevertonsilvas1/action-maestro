
-- Add soft-delete fields to winners table
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS deleted_by text DEFAULT NULL;

-- Create index for efficient filtering of non-deleted records
CREATE INDEX IF NOT EXISTS idx_winners_deleted_at ON public.winners (deleted_at) WHERE deleted_at IS NULL;
