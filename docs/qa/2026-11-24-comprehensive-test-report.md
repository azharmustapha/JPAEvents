# Laporan ujian menyeluruh JPAEvents

Tarikh: 24 November 2026. Permintaan: “cuba test semua”.

## Keputusan

Pemeriksaan akhir selepas pembetulan: **136/136 ujian automatik lulus**, 0 gagal dan 0 dilangkau. **Lint, TypeScript, build produksi dan semakan whitespace Git lulus**.

## Aplikasi sebenar di localhost:3000

- Halaman utama diperiksa pada lebar 1440, 768 dan 390 piksel tanpa limpahan mendatar atau ralat JavaScript.
- Menu mudah alih boleh dibuka dan ditutup dengan Escape.
- Halaman admin, cipta acara, agenda, pengimbas, cabutan dan edit acara memulangkan redirect 307 ke log masuk untuk pelawat tanpa sesi.
- Acara yang tidak wujud memulangkan 404. Format token pas yang tidak sah memaparkan mesej pemulihan.
- Borang log masuk menyekat e-mel kosong dan menyembunyikan kata laluan. Borang daftar akaun mempunyai had minimum 12 aksara.

## Ujian pelayar dengan akaun dan data sementara

Salinan aplikasi di localhost:3011 menggunakan API ujian localhost:4011, pangkalan data PGlite dengan SQL/RLS JPAEvents sebenar dan simulasi Supabase Auth/Storage. Tiada akaun atau e-mel sebenar dicipta atau dihantar untuk ujian ini.

| Aliran | Keputusan yang disahkan |
| --- | --- |
| Log masuk penganjur | Akaun ujian boleh masuk; setiap penganjur hanya melihat acara sendiri |
| Akaun baharu | Daftar → arahan semak e-mel → pautan pengesahan simulasi → onboarding → dashboard |
| Ruang penganjur | Nama ruang disimpan; membuka onboarding semula menghala ke dashboard |
| Cipta acara | Acara baharu bermula sebagai draf; pautan awam memulangkan 404 |
| Terbit dan buka | Dua acara berbeza boleh dibuka serentak |
| Edit acara | Tajuk, tema, tarikh dan susun atur kekal selepas reload |
| Logo dan banner | PNG dimuat naik dan dipaparkan; SVG ditolak dengan mesej jelas |
| Warna dan responsif | Tema putih mengekalkan teks butang hitam dan navigasi gelap; paparan telefon tidak melimpah |
| Organisasi pilihan | Pendaftaran berjaya tanpa organisasi atau persetujuan apabila tidak diwajibkan |
| Tetapan wajib | Organisasi wajib dan kotak persetujuan dikuatkuasakan |
| Persetujuan berubah | Borang lama ditolak dan meminta pengguna memuat semula serta menyemak syarat terkini |
| Pendua | Nama yang sama selepas normalisasi ditolak tanpa mendedahkan token lama |
| Peserta tanpa akaun | Pendaftaran selepas penganjur log keluar tetap menghasilkan pas digital |
| Pas dan eksport | QR sepadan dengan token; banner kekal pada pas; PNG dan PDF berjaya dimuat turun |
| PDF | PDF sebenar mempunyai satu halaman dan pautan boleh klik ke pas peserta yang betul |
| Pengimbas QR | Imej QR sebenar diimbas; penganjur lain ditolak; pengimbas pemilik merekod daftar hadir |
| Imbas berulang | Masa daftar hadir pertama dikekalkan tanpa pendua |
| Agenda | Tambah, edit, paparan awam dan padam item ujian berjaya |
| Pemilih acara agenda | Tiada acara dipilih secara tersirat; butang tambah tidak aktif sehingga pemilihan dibuat |
| Senarai peserta | Carian e-mel menapis kepada satu rekod yang betul |
| CSV | Fail mengandungi dua peserta acara terpilih, waktu pendaftaran dan waktu daftar hadir; peserta acara lain tidak termasuk |
| Pratonton dan pautan | Pas boleh dipratonton, modal ditutup dengan Escape dan pautan disalin |
| Projektor | QR muncul apabila dibuka, hilang apabila ditutup, dan butiran disembunyikan apabila acara dinyahterbit |
| Pas selepas penutupan | Pas sedia ada dan status daftar hadir masih boleh dibuka |
| Cabutan | Dua peserta berbeza menjadi pemenang selepas pendaftaran ditutup; sejarah kekal selepas reload; butang dinyahaktif apabila calon habis |
| Pengasingan penganjur | Edit acara dan imbasan QR bagi acara penganjur lain ditolak |

## Supabase sebenar

16 kumpulan assertion SQL lulus dalam satu transaksi BEGIN/ROLLBACK pada projek sedia ada. Semakan selepas rollback dibuat secara berasingan.

Liputan termasuk onboarding idempotent, draf peribadi, tetapan tidak sah, RLS dan RPC pemilikan, agenda CRUD, organisasi/persetujuan wajib, syarat lapuk, pendua, nombor pas, kiraan awam, data pas tanpa e-mel, check-in idempotent, cabutan selepas penutupan dan calon yang dikecualikan.

Semua enam jadual JPAEvents kembali kosong selepas rollback. Rekod aplikasi asal kekal: 5 pentadbir dan 6,776 rekod audit; jadual asal lain dan Storage tidak berubah. Tiada perubahan Auth, kata laluan, objek Storage atau rekod pengguna sedia ada dibuat oleh ujian ini.

## Pembetulan semasa ujian

1. Pemilih acara agenda sebelum ini boleh kelihatan seolah-olah acara pertama dipilih walaupun keadaan borang belum memilih acara. Ditambah pilihan kosong yang jelas serta hubungan label kepada dropdown; disahkan melalui pelayar.
2. Jumlah pendaftaran dilabel semula sebagai “Peserta berdaftar” supaya tidak disalah anggap sebagai jumlah kehadiran fizikal.
3. Build pelayar sementara menggunakan direktori QA berasingan. Artifak QA dikecualikan daripada lint dan TypeScript supaya tidak mengganggu aplikasi utama.

## Batas semakan

- Penghantaran e-mel dan pautan pengesahan daripada penyedia Supabase sebenar belum diuji; aliran callback aplikasi diuji menggunakan simulasi tempatan.
- Kata laluan akaun pengguna sebenar tidak diminta atau digunakan. Log masuk berjaya diuji dengan akaun sementara tempatan, manakala sambungan Auth sebenar telah diperiksa berasingan sebelum ujian ini.
- Imbasan fail QR diuji dengan decoder sebenar. Kamera telefon, kebenaran kamera, native share sheet, Safari/iOS/Android sebenar belum disahkan pada peranti fizikal.
- Muat naik dan RLS Storage diuji pada perkhidmatan sementara dengan SQL sebenar; tiada fail dimuat naik ke bucket produksi.
- Ujian beban pelbagai sambungan PostgreSQL sebenar, ujian Docker runtime dan deployment awam belum dijalankan. Suite terbenam tidak dianggap sebagai bukti kapasiti produksi.
- Studio dan pautan hostingnya masih menunggu URL deployment, seperti skop yang dipersetujui.

Pelayan dan akaun ujian sementara ditutup selepas semakan; pelayan pengguna di port3000 dikekalkan.
