# JPAEvents

JPAEvents ialah aplikasi web untuk mengurus pendaftaran acara, pas digital dan kehadiran peserta. Penganjur boleh menyediakan halaman acara dengan identiti sendiri, berkongsi pautan pendaftaran dan mengurus acara melalui satu papan pemuka. Peserta boleh mendaftar tanpa mencipta akaun.

## Ciri utama

- **Ruang kerja penganjur:** akaun dengan pengesahan e-mel dan pengurusan beberapa acara dalam ruang kerja sendiri.
- **Halaman acara:** tajuk, tarikh, masa, zon masa, lokasi, logo, banner, warna dan susun atur yang boleh disesuaikan.
- **Pendaftaran peserta:** nama penuh dan e-mel, dengan organisasi serta pernyataan persetujuan mengikut tetapan acara.
- **Pas digital:** pas peserta dengan kod QR serta muat turun PNG dan PDF.
- **Daftar hadir:** imbas kod QR pas untuk merekod kehadiran pada hari acara.
- **Atur cara dan tayangan:** urus agenda serta paparkan maklumat acara dan QR pendaftaran pada projektor.
- **Cabutan bertuah:** jalankan cabutan dan semak sejarah pemenang acara.
- **Eksport CSV:** muat turun senarai peserta dan rekod kehadiran untuk laporan atau penyediaan sijil.

## Cara menggunakan JPAEvents

### Untuk penganjur

1. Buka halaman utama dan pilih **Cipta akaun penganjur**.
2. Daftar menggunakan e-mel, sahkan akaun melalui pautan yang diterima dan log masuk.
3. Namakan ruang kerja anda, kemudian cipta acara baharu.
4. Lengkapkan butiran acara, tetapkan tema dan sesuaikan keperluan borang pendaftaran.
5. Pratonton halaman acara, terbitkan acara dan buka pendaftaran.
6. Kongsi pautan `/events/[slug]` atau paparkan kod QR pendaftaran kepada peserta.
7. Melalui papan pemuka, semak peserta, urus atur cara, imbas pas untuk daftar hadir dan jalankan cabutan bertuah.
8. Eksport laporan CSV apabila diperlukan dan tutup pendaftaran selepas tamat tempoh pendaftaran.

Pendaftaran dan daftar hadir ialah dua rekod berbeza: peserta yang telah mendaftar masih perlu melalui proses daftar hadir pada hari acara.

### Untuk peserta

1. Buka pautan acara atau imbas kod QR yang dikongsi oleh penganjur.
2. Semak butiran acara dan atur cara, kemudian buka borang pendaftaran.
3. Isi nama penuh, e-mel dan maklumat tambahan yang diminta. Tandakan persetujuan jika berkenaan.
4. Selepas berjaya mendaftar, simpan pautan pas digital atau muat turun pas dalam format PNG/PDF.
5. Tunjukkan kod QR pas kepada petugas untuk daftar hadir.

Simpan pautan pas secara peribadi kerana sesiapa yang mempunyai pautan tersebut boleh membuka pas anda. Jika nama anda telah didaftarkan, buka pas yang disimpan atau hubungi penganjur.

## Teknologi pembangunan

| Teknologi | Kegunaan |
| --- | --- |
| Next.js 16.3.6 (App Router) | Kerangka aplikasi web, halaman pelayan dan laluan API |
| React 19.2.8 | Komponen antaramuka dan interaksi pengguna |
| TypeScript 5 | Jenis data dan pembangunan kod aplikasi |
| Tailwind CSS 4 | Penggayaan dan paparan responsif |
| Supabase PostgreSQL | Penyimpanan acara, peserta, kehadiran dan rekod cabutan |
| Supabase Auth dan `@supabase/ssr` | Pendaftaran penganjur, pengesahan e-mel dan sesi pengguna |
| Supabase Storage | Penyimpanan logo dan imej acara |
| `qrcode.react` dan `html5-qrcode` | Penjanaan dan pengimbasan kod QR |
| `html-to-image` dan `pdf-lib` | Eksport pas digital kepada PNG dan PDF |
| Lucide React | Ikon antaramuka |
| Node.js dan npm | Persekitaran pelaksanaan serta pengurusan pakej |
| Docker dan Docker Compose | Pembinaan dan pelaksanaan aplikasi dalam container |
| ESLint, Node.js Test Runner dan PGlite | Semakan kod, ujian unit dan ujian pangkalan data terbenam |

Data ruang kerja diasingkan melalui dasar akses pangkalan data dan fungsi RPC.

## Pemasangan untuk pembangunan

### Keperluan

- Node.js 24, selaras dengan imej Docker projek, serta npm.
- Projek Supabase dengan akses kepada SQL Editor, Auth dan Storage.
- Git untuk mendapatkan kod sumber.

### 1. Dapatkan kod sumber

```powershell
git clone https://github.com/azharmustapha/JPAEvents.git
cd JPAEvents
npm ci
Copy-Item .env.example .env.local
```

### 2. Sediakan Supabase

Untuk **projek Supabase baharu yang khusus untuk JPAEvents**:

1. Jalankan `supabase/schema.sql` melalui SQL Editor.
2. Jalankan `supabase/storage.sql` untuk menyediakan storan imej acara.
3. Aktifkan pendaftaran e-mel/kata laluan dan pengesahan e-mel (**Confirm email**).
4. Tetapkan Auth Site URL kepada alamat aplikasi dan benarkan URL penghalaan semula `/auth/confirm`.
5. Dalam templat e-mel Confirm signup, gunakan pautan pengesahan berikut:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Jika Supabase turut digunakan oleh aplikasi lain, gunakan `supabase/shared-project.sql` dan `supabase/shared-storage.sql` sebagai ganti fail skema/storan di atas, kemudian tetapkan `NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT=true`. Mod ini menggunakan jadual dan fungsi berawalan `jpaevents_` serta bucket `jpaevents-event-assets`.

Untuk pemasangan sedia ada, ikuti [panduan naik taraf pangkalan data](docs/database-upgrade.md). Jangan jalankan skema pemasangan baharu pada pangkalan data yang telah berisi.

### 3. Tetapkan persekitaran

Isi `.env.local` menggunakan konfigurasi projek Supabase anda:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT=false
```

Gunakan kunci awam publishable/anon sahaja. Jangan letakkan kunci `service_role` atau secret key dalam pemboleh ubah `NEXT_PUBLIC_*`. Fail persekitaran peribadi dikecualikan daripada Git; `.env.example` disediakan sebagai rujukan.

### 4. Jalankan aplikasi

```powershell
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000), cipta akaun penganjur dan ikuti langkah penggunaan di atas.

## Pelaksanaan produksi

Untuk pelaksanaan terus dengan Node.js, sediakan pemboleh ubah persekitaran sebelum membina aplikasi:

```powershell
npm run build
npm start
```

Untuk Docker, sediakan `.env.production` berpandukan `.env.example`, kemudian jalankan:

```powershell
docker compose --env-file .env.production up -d --build
```

Aplikasi menggunakan port `3000`. Konfigurasi awam Supabase diperlukan ketika proses build; bina semula aplikasi jika nilainya berubah. Tetapkan URL Auth kepada domain produksi dan gunakan HTTPS untuk akses kamera pengimbas QR pada peranti petugas. Jika menggunakan reverse proxy, pastikan hos awam sebenar diteruskan dengan betul.

## Laluan utama

| Laluan | Fungsi |
| --- | --- |
| `/` | Halaman utama JPAEvents |
| `/signup` | Pendaftaran akaun penganjur |
| `/admin/login` | Log masuk penganjur |
| `/onboarding` | Persediaan ruang kerja |
| `/admin` | Papan pemuka acara dan peserta |
| `/admin/sesi-baru` | Cipta acara |
| `/admin/events/[id]` | Tetapan acara |
| `/events/[slug]` | Halaman awam acara |
| `/events/[slug]/daftar` | Borang pendaftaran |
| `/events/[slug]/atur-cara` | Atur cara |
| `/events/[slug]/tayangan` | Paparan projektor dan QR pendaftaran |
| `/pasport/[token]` | Pas digital peserta |
| `/admin/imbas?event=ID` | Pengimbas daftar hadir |
| `/admin/tentatif?event=ID` | Pengurusan atur cara |
| `/admin/cabutan?event=ID` | Cabutan bertuah |

Gantikan `[slug]`, `[id]`, `[token]` dan `ID` dengan nilai sebenar acara atau peserta.

## Semakan pembangunan

```powershell
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Ujian unit dan pangkalan data terbenam tidak memerlukan kelayakan produksi. Ujian langsung Auth/pangkalan data memerlukan konfigurasi `TEST_*` dan projek ujian berasingan. Penghantaran e-mel, muat naik ke Storage, kamera dan sesi pada domain produksi perlu disahkan pada persekitaran sasaran.

## Struktur projek

| Direktori | Kandungan |
| --- | --- |
| `app/` | Halaman, susun atur dan laluan API |
| `components/` | Komponen antaramuka penganjur dan peserta |
| `lib/` | Logik acara, pengesahan, akses data dan eksport |
| `supabase/` | Skema, migrasi, konfigurasi storan dan ujian SQL |
| `tests/` | Ujian unit dan pangkalan data |
| `public/` | Aset awam |
| `docs/` | Panduan pangkalan data dan integrasi |

Eksport CSV boleh digunakan untuk pemindahan peserta secara manual ke aplikasi sijil berasingan. Lihat [panduan integrasi Studio](docs/studio-integration.md) untuk aliran kerja tersebut.
