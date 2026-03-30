-- Add lote_forcado to the winner_status enum
ALTER TYPE public.winner_status ADD VALUE IF NOT EXISTS 'lote_forcado';