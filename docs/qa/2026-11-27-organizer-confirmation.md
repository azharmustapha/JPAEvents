# Semakan aliran pengesahan penganjur — 27 November 2026

## Pembaikan setempat

- Signup dan permintaan pengesahan semula menghantar `redirect_to=https://jpaevents.vercel.app/auth/confirm` dalam build produksi.
- Callback token dan PKCE menghala ke domain rasmi, termasuk apabila URL dalaman permintaan ialah localhost. Parameter destinasi luar tidak digunakan.
- Callback menggunakan `private, no-store` dan `no-referrer`.
- Token gagal/tamat tempoh menyediakan halaman pemulihan dan permintaan e-mel baharu; permintaan berjaya mempunyai tempoh menunggu 60 saat.
- Templat produksi Bahasa Melayu disediakan di `supabase/templates/confirm-signup.html`.

## Pengesahan

- `npm test`: 152 lulus, 0 gagal.
- `npm run lint`: lulus.
- `npm run build`: lulus, termasuk semakan TypeScript.
- Ujian pelayar pada build produksi setempat: daftar akaun dengan respons Auth tiruan, arahan semak e-mel, paparan alamat e-mel, URL callback signup/resend, status permintaan semula, butang tempoh menunggu dan halaman pemulihan lulus.
- Paparan pemulihan pada lebar 390px diperiksa dan tidak melimpah secara mendatar.
- Satu ralat konsol tempatan ialah 404 `/_vercel/speed-insights/script.js`, yang tersedia di Vercel dan tidak berkaitan dengan pengesahan.
- Tiada akaun sebenar dicipta atau e-mel sebenar dihantar semasa ujian pelayar. Semua permintaan signup/resend dipintas dengan respons tiruan.

## Belum disahkan pada produksi

Dashboard Supabase dalam pelayar memerlukan log masuk pengguna. Site URL, senarai Redirect URLs dan templat e-mel sebenar belum dibaca atau diubah. Kod belum di-deploy dalam sesi ini. Ujian penghantaran e-mel dan pengesahan rentas peranti sebenar menunggu tetapan serta deployment dalam `docs/organizer-email-setup.md`.
