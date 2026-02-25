
-- Add last_inbound_at column to winners
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS last_inbound_at timestamp with time zone;

-- Create index for inbound matching performance
CREATE INDEX IF NOT EXISTS idx_winners_last_inbound_at ON public.winners(last_inbound_at);

-- Enable realtime for winners table
ALTER PUBLICATION supabase_realtime ADD TABLE public.winners;
