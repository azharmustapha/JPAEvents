# Pengesahan akaun penganjur

Domain produksi: **https://jpaevents.vercel.app**
Projek Supabase: **JPAEvents** (`bdhkiesduxjgxnxzdusl`).

## Tetapan Supabase yang perlu disimpan

Di Authentication → URL Configuration:

- Site URL: `https://jpaevents.vercel.app`
- Redirect URLs: `https://jpaevents.vercel.app/auth/confirm`
- Tambah `http://localhost:3000/auth/confirm` hanya jika pembangunan tempatan memerlukan pengesahan e-mel. Site URL produksi kekal domain awam.

Di Authentication → Email / Templates → Confirm signup:

- Subject: **Sahkan e-mel akaun penganjur JPAEvents**
- Body: salin keseluruhan `supabase/templates/confirm-signup.html`.
- Pastikan **Confirm email** diaktifkan. Jangan matikan pengesahan untuk mengatasi masalah pautan.

Templat produksi menggunakan alamat pengesahan rasmi secara terus, bukannya nilai lalai Site URL yang mungkin masih localhost. Ia menghantar `token_hash` kepada `/auth/confirm` supaya pengesahan tidak bergantung pada pelayar asal yang menyimpan kod PKCE. Kedua-dua butang dan pautan salinan menggunakan alamat sama. Jika domain berubah, kemas kini templat ini bersama tetapan URL.

## Tetapan aplikasi / Vercel

Tetapkan `NEXT_PUBLIC_SITE_URL=https://jpaevents.vercel.app` untuk Production dan bina/deploy semula aplikasi. Kod juga mempunyai domain rasmi ini sebagai nilai lalai produksi. Alamat localhost dan protokol selain HTTPS ditolak jika dikonfigurasi untuk produksi. `NEXT_PUBLIC_` dibaca semasa build; ubah nilainya sebelum membina aplikasi.

Untuk ujian tempatan berasingan, gunakan `NEXT_PUBLIC_SITE_URL=http://localhost:3000` dalam `.env.local` dengan `npm run dev` dan templat pengesahan pada projek ujian yang menghala ke pelayan tempatan. Jangan gantikan templat projek produksi dengan localhost.

## Aliran pengguna

1. Penganjur mengisi nama, e-mel dan kata laluan di `/signup`.
2. Halaman meminta pengguna menyemak peti masuk/spam dan menyediakan permintaan e-mel baharu.
3. Butang **Sahkan e-mel & teruskan** membuka domain rasmi `/auth/confirm?token_hash=…&type=email`.
4. Pelayan mengesahkan token dan menetapkan sesi, kemudian membuka `/onboarding?confirmed=1`. Ruang kerja yang sudah wujud dibawa ke `/admin`.
5. Token tidak sah, tamat tempoh atau sudah digunakan dibawa ke `/auth/confirmation-error`, yang menyediakan log masuk dan permintaan e-mel baharu.

Pautan dalam e-mel lama tidak berubah selepas templat disimpan. Minta e-mel baharu melalui aplikasi selepas deployment dan perubahan tetapan siap.

## Pengesahan selepas deployment

- Daftar akaun ujian yang anda kawal, semak subjek/kandungan e-mel dan pastikan pautan tidak mengandungi localhost.
- Buka pengesahan pada peranti atau pelayar lain; pastikan sampai ke ruang penganjur di domain rasmi.
- Buka semula pautan yang sudah digunakan dan uji permintaan pautan baharu.
- Semak akaun sedia ada masih boleh log masuk dan ruang kerja kekal diasingkan.

Ujian automatik tempatan meliputi redirect di belakang proxy localhost, pertukaran kod PKCE, token tidak sah, destinasi yang tetap, konfigurasi domain dan larangan cache respons pengesahan. Penghantaran e-mel sebenar memerlukan tetapan Supabase dan deployment di atas.

Rujukan: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
