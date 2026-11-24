export interface Perhimpunan {
    workspace_id?: string;
    slug?: string;
    description?: string;
    organizer_name?: string;
    timezone?: string;
    published?: boolean;
    primary_color?: string;
    accent_color?: string;
    layout?: string;
    logo_url?: string | null;
    banner_url?: string | null;
    require_organization?: boolean;
    consent_text?: string | null;
    draw_exclude_first?: number;
    id: string;
    tajuk: string;
    tema?: string | null;
    tarikh: string;
    masa_mula: string;
    lokasi: string;
    kod_sesi: string;
    status_aktif: boolean;
    dicipta_pada?: string;
}

export interface KehadiranPeserta {
    id: string;
    perhimpunan_id: string;
    nama_pegawai: string;
    bahagian_unit: string;
    emel?: string | null;
    akur_janji_pada?: string | null;
    waktu_hadir: string;
    checked_in_at?: string | null;
    token_pasport: string;
    no_pasport?: number;
    dicipta_pada?: string;
}

export interface AturCara {
    id: string;
    perhimpunan_id: string;
    masa_mula: string | null;
    masa_tamat?: string | null;
    tajuk_agenda: string;
    keterangan?: string | null;
    turutan: number;
    status_selesai: boolean;
    dicipta_pada?: string;
}

export interface DaftarKehadiranPayload {
    kod_sesi: string;
    nama_pegawai: string;
    bahagian_unit: string;
    emel: string;
    akur_janji: boolean;
}

export interface CabutanPemenang {
    id: string;
    perhimpunan_id: string;
    peserta_id: string;
    nama_pegawai: string;
    bahagian_unit: string;
    no_pasport: number;
    dicipta_pada: string;
}

export interface PassportData {
    checked_in_at?: string | null;
    nama_pegawai: string;
    bahagian_unit: string;
    waktu_hadir: string;
    token_pasport: string;
    no_pasport?: number;
    perhimpunan: Pick<Perhimpunan, 'tajuk' | 'tema' | 'tarikh' | 'lokasi' | 'kod_sesi' | 'slug' | 'logo_url' | 'banner_url' | 'primary_color' | 'accent_color' | 'organizer_name' | 'timezone'>;
}

export type Acara = Perhimpunan;
