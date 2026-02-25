
-- Add phone_e164 column for normalized E.164 phone numbers
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS phone_e164 text;

-- Create index for phone_e164 lookups (used in inbound matching)
CREATE INDEX IF NOT EXISTS idx_winners_phone_e164 ON public.winners (phone_e164);

-- Backfill existing records: normalize phone to +55DDDNUMERO format
UPDATE public.winners
SET phone_e164 = CASE
  WHEN phone IS NULL OR trim(phone) = '' THEN NULL
  WHEN regexp_replace(phone, '\D', '', 'g') ~ '^\d{10,11}$' THEN '+55' || regexp_replace(phone, '\D', '', 'g')
  WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55\d{10,11}$' THEN '+' || regexp_replace(phone, '\D', '', 'g')
  ELSE NULL
END
WHERE phone IS NOT NULL AND phone_e164 IS NULL;
