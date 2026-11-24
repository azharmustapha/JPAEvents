-- Untimed main activities follow the previous timed block in turutan order.
-- Works with both existing TEXT and TIME columns. No existing rows are changed.
BEGIN;
ALTER TABLE public.atur_cara ALTER COLUMN masa_mula DROP NOT NULL;
COMMIT;
