-- ==============================================================================
-- Skema Pangkalan Data: Acara (PostgreSQL / Supabase)
-- Fail: supabase/schema.sql
-- ==============================================================================

-- 1. Jadual: Perhimpunan
CREATE TABLE IF NOT EXISTS perhimpunan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tajuk TEXT NOT NULL,
    tema TEXT,
    tarikh DATE NOT NULL,
    masa_mula TEXT NOT NULL,
    lokasi TEXT NOT NULL,
    kod_sesi TEXT UNIQUE NOT NULL,
    status_aktif BOOLEAN DEFAULT true,
    dicipta_pada TIMESTAMPTZ DEFAULT now()
);

-- Indeks carian kod sesi
CREATE INDEX IF NOT EXISTS idx_perhimpunan_kod_sesi ON perhimpunan (kod_sesi);
CREATE INDEX IF NOT EXISTS idx_perhimpunan_status_aktif ON perhimpunan (status_aktif);

-- 2. Jadual: Kehadiran Peserta
CREATE TABLE IF NOT EXISTS kehadiran_peserta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perhimpunan_id UUID NOT NULL REFERENCES perhimpunan(id) ON DELETE CASCADE,
    nama_pegawai TEXT NOT NULL,
    bahagian_unit TEXT NOT NULL,
    waktu_hadir TIMESTAMPTZ DEFAULT now(),
    token_pasport TEXT UNIQUE NOT NULL,
    dicipta_pada TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unik_kehadiran_pegawai UNIQUE (perhimpunan_id, nama_pegawai)
);

-- Indeks carian pantas
CREATE INDEX IF NOT EXISTS idx_kehadiran_token ON kehadiran_peserta (token_pasport);
CREATE INDEX IF NOT EXISTS idx_kehadiran_perhimpunan ON kehadiran_peserta (perhimpunan_id);

-- 3. Jadual: Atur Cara Majlis
CREATE TABLE IF NOT EXISTS atur_cara (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perhimpunan_id UUID NOT NULL REFERENCES perhimpunan(id) ON DELETE CASCADE,
    masa_mula TEXT NOT NULL,
    masa_tamat TEXT,
    tajuk_agenda TEXT NOT NULL,
    keterangan TEXT,
    turutan INTEGER NOT NULL DEFAULT 0,
    status_selesai BOOLEAN DEFAULT false,
    dicipta_pada TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atur_cara_perhimpunan ON atur_cara (perhimpunan_id, turutan);

-- 4. Polisi Keselamatan Peringkat Baris (Row Level Security - RLS)
ALTER TABLE perhimpunan ENABLE ROW LEVEL SECURITY;
ALTER TABLE kehadiran_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE atur_cara ENABLE ROW LEVEL SECURITY;

-- Benarkan capaian bacaan umum (Public Select)
CREATE POLICY "Akses Bacaan Umum Perhimpunan" ON perhimpunan FOR SELECT USING (true);
CREATE POLICY "Akses Bacaan Umum Kehadiran" ON kehadiran_peserta FOR SELECT USING (true);
CREATE POLICY "Akses Bacaan Umum Atur Cara" ON atur_cara FOR SELECT USING (true);

-- Benarkan pendaftaran kehadiran kendiri oleh pengguna awam (Public Insert)
CREATE POLICY "Akses Pendaftaran Awam Kehadiran" ON kehadiran_peserta FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- Data Contoh Permulaan (Seed Data)
-- ==============================================================================

INSERT INTO perhimpunan (id, tajuk, tema, tarikh, masa_mula, lokasi, kod_sesi, status_aktif)
VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Bengkel Komuniti',
    'Belajar Bersama',
    '2026-10-15',
    '08:30:00',
    'Dewan Utama',
    'SAMPLE-26',
    true
)
ON CONFLICT (kod_sesi) DO NOTHING;

INSERT INTO atur_cara (perhimpunan_id, masa_mula, masa_tamat, tajuk_agenda, keterangan, turutan, status_selesai)
VALUES 
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '08:00',
    '08:30',
    'Ketibaan Peserta & Pendaftaran Kendiri',
    'Imbasan Kod QR skrin besar & penjanaan pasport digital',
    1,
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '08:30',
    '08:45',
    'Pengenalan Fasilitator',
    'Peserta berkenalan dengan fasilitator',
    2,
    false
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '08:45',
    '09:00',
    'Pembukaan Bengkel',
    'Dipimpin oleh fasilitator',
    3,
    false
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '09:00',
    '09:45',
    'Perbincangan Kumpulan',
    'Bincangkan idea untuk projek kumpulan',
    4,
    false
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '09:45',
    '10:15',
    'Pembentangan Projek',
    'Setiap kumpulan membentangkan projek',
    5,
    false
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '10:15',
    '10:30',
    'Sesi Fotografi & Jamuan Ringan',
    'Majlis bersurai ke foyer utama',
    6,
    false
)
ON CONFLICT DO NOTHING;
