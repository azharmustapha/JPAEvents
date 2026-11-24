-- Synthetic historical import fixture.
BEGIN;
LOCK TABLE public.atur_cara IN SHARE ROW EXCLUSIVE MODE;

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.perhimpunan
    WHERE id = '00000000-0000-4000-8000-000000000088'::uuid
      AND kod_sesi = 'SAMPLE2026' AND tarikh = DATE '2026-10-19'
  ) THEN
    RAISE EXCEPTION 'Expected SAMPLE2026 session on 19 October 2026 was not found. No agenda was changed.';
  END IF;
END;
$check$;

ALTER TABLE public.atur_cara ALTER COLUMN masa_mula DROP NOT NULL;

CREATE TEMP TABLE poster_agenda (
  turutan integer PRIMARY KEY,
  masa_mula time,
  tajuk_agenda text UNIQUE NOT NULL,
  previous_title text
) ON COMMIT DROP;

INSERT INTO poster_agenda(turutan, masa_mula, tajuk_agenda, previous_title) VALUES
  (1, '08:00', 'Workshop activity 1', NULL),
  (2, '08:10', 'Workshop activity 2', NULL),
  (3, NULL, 'Workshop activity 3', NULL),
  (4, '08:15', 'Workshop activity 4', NULL),
  (5, '08:25', 'Workshop activity 5', 'Previous activity 5'),
  (6, '08:35', 'Workshop activity 6', NULL),
  (7, '08:45', 'Workshop activity 7', NULL),
  (8, NULL, 'Workshop activity 8', 'Previous activity 8'),
  (9, NULL, 'Workshop activity 9', NULL),
  (10, '09:00', 'Workshop activity 10', 'Previous activity 10'),
  (11, '09:05', 'Workshop activity 11', NULL),
  (12, '09:15', 'Workshop activity 12', 'Previous activity 12'),
  (13, '09:20', 'Workshop activity 13', NULL),
  (14, '09:25', 'Workshop activity 14', 'Previous activity 14'),
  (15, '09:30', 'Workshop activity 15', 'Previous activity 15'),
  (16, NULL, 'Workshop activity 16', 'Previous activity 16'),
  (17, NULL, 'Workshop activity 17', 'Previous activity 17'),
  (18, NULL, 'Workshop activity 18', 'Previous activity 18'),
  (19, NULL, 'Workshop activity 19', 'Previous activity 19'),
  (20, NULL, 'Workshop activity 20', NULL),
  (21, NULL, 'Workshop activity 21', NULL),
  (22, '10:00', 'Workshop activity 22', NULL),
  (23, '10:15', 'Workshop activity 23', 'Previous activity 23');

DO $check$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.atur_cara a JOIN poster_agenda p
      ON a.tajuk_agenda = p.tajuk_agenda OR a.tajuk_agenda = p.previous_title
    WHERE a.perhimpunan_id = '00000000-0000-4000-8000-000000000088'::uuid
    GROUP BY p.turutan HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate old/new agenda titles exist in SAMPLE2026. Review them before importing; no agenda rows were changed.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.atur_cara a
    WHERE a.perhimpunan_id = '00000000-0000-4000-8000-000000000088'::uuid
      AND a.tajuk_agenda NOT IN ('Retired workshop', 'Retired closing')
      AND NOT EXISTS (
        SELECT 1 FROM poster_agenda p
        WHERE a.tajuk_agenda = p.tajuk_agenda OR a.tajuk_agenda = p.previous_title
      )
  ) THEN
    RAISE EXCEPTION 'SAMPLE2026 has unrecognized activities. Review them before importing; no agenda rows were changed.';
  END IF;
END;
$check$;

-- Owner-only snapshot for recovery; reruns preserve the original backup.
CREATE TABLE IF NOT EXISTS public.atur_cara_import_backups (
  perhimpunan_id uuid PRIMARY KEY REFERENCES public.perhimpunan(id),
  agenda jsonb NOT NULL,
  disimpan_pada timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.atur_cara_import_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atur_cara_import_backups FROM PUBLIC, anon, authenticated;
INSERT INTO public.atur_cara_import_backups(perhimpunan_id, agenda)
SELECT '00000000-0000-4000-8000-000000000088'::uuid,
  coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.turutan, a.id), '[]'::jsonb)
FROM public.atur_cara a
WHERE a.perhimpunan_id = '00000000-0000-4000-8000-000000000088'::uuid
ON CONFLICT (perhimpunan_id) DO NOTHING;

-- These old activities were removed/combined by the revised source.
DELETE FROM public.atur_cara
WHERE perhimpunan_id = '00000000-0000-4000-8000-000000000088'::uuid
  AND tajuk_agenda IN ('Retired workshop', 'Retired closing');

UPDATE public.atur_cara a
SET masa_mula = p.masa_mula, masa_tamat = NULL,
  turutan = p.turutan, tajuk_agenda = p.tajuk_agenda
FROM poster_agenda p
WHERE a.perhimpunan_id = '00000000-0000-4000-8000-000000000088'::uuid
  AND (a.tajuk_agenda = p.tajuk_agenda OR a.tajuk_agenda = p.previous_title);

INSERT INTO public.atur_cara(perhimpunan_id, masa_mula, masa_tamat, tajuk_agenda, turutan)
SELECT '00000000-0000-4000-8000-000000000088'::uuid, p.masa_mula, NULL, p.tajuk_agenda, p.turutan
FROM poster_agenda p
WHERE NOT EXISTS (
  SELECT 1 FROM public.atur_cara a
  WHERE a.perhimpunan_id = '00000000-0000-4000-8000-000000000088'::uuid
    AND a.tajuk_agenda = p.tajuk_agenda
);

COMMIT;

SELECT turutan, masa_mula, masa_tamat, tajuk_agenda
FROM public.atur_cara
WHERE perhimpunan_id = '00000000-0000-4000-8000-000000000088'::uuid
ORDER BY turutan;
