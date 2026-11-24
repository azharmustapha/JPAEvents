# Navigasi awam dan projek Supabase JPAEvents

Permintaan pengguna: kemas kini UI/UX, navbar awam hanya Utama dan Log Masuk; fungsi pengurusan tersedia selepas log masuk; gunakan projek pangkalan data baharu untuk JPAEvents.

Keputusan pengguna: pendaftaran peserta, agenda awam dan pas kekal tanpa akaun. Projek baharu ditempatkan dalam organisasi Jabatan Perkhidmatan Awam (JPA). Rantau yang dicadangkan: ap-southeast-1 (Singapore).

## Perubahan siap

- Navbar desktop dan mudah alih hanya mengandungi Utama dan Log Masuk, selain pautan logo.
- Footer awam menggunakan dua pautan yang sama.
- Bantuan log masuk menerangkan pengesahan e-mel dan ruang penganjur; arahan lama yang memerlukan pemberian akses urus setia telah dibuang.
- Pengurusan acara, tema, peserta, agenda, pengimbas dan cabutan kekal dilindungi oleh pengesahan serta keahlian ruang penganjur. Pautan peserta kekal awam mengikut keputusan pengguna.

Semakan pelayar: desktop1440px dan telefon390px menunjukkan menu dua pautan; menu Escape berfungsi; tiada limpahan mendatar. Lint, TypeScript dan build produksi lulus.

## Projek baharu: siap disambungkan

Pengguna membekalkan projek JPAEvents `bdhkiesduxjgxnxzdusl` pada 24 November 2026. Projek berada dalam organisasi JPA, rantau ap-south-1, dan status ACTIVE_HEALTHY. Pemeriksaan awal mengesahkan tiada jadual awam.

Migrasi `jpaevents_initial_schema` dan `jpaevents_image_storage` dipasang. Enam jadual awam menggunakan RLS; bucket event-assets menerima PNG/JPG/WebP sehingga 5 MB. Signup e-mel diaktifkan dan pengesahan e-mel diwajibkan. URL/kunci awam projek baharu disimpan dalam .env.local dan .env.production yang diabaikan Git; NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT=false.

Semakan API acara dan tetapan Auth memulangkan HTTP200. Ujian SQL access-control dan independent-event dijalankan dengan rollback dan lulus; pemeriksaan selepasnya mengesahkan Auth users, workspaces, events dan attendees masih kosong. Build produksi lulus dengan konfigurasi khusus. Akaun/kata laluan/data projek lama tidak dipindahkan dan projek lama tidak diubah dalam pertukaran ini.

Penganjur perlu mencipta akaun JPAEvents baharu, mengesahkan e-mel dan menyediakan ruang penganjur. Jika pelayan pembangunan atau tab lama masih menyimpan konfigurasi/sesi lama, mulakan semula npm run dev dan muat semula halaman.

## Rekod halangan terdahulu

Panggilan create_project untuk JPAEvents pada organisasi yang dipilih ditolak oleh Supabase kerana pemilik azharmustapha telah mencapai had dua projek percuma aktif merentas organisasi. get_cost memulangkan US$0 sebulan untuk projek, tetapi penciptaan masih dihalang oleh had slot. Tiada projek baharu dicipta.

Pilihan telah diminta daripada pengguna: kosongkan slot percuma, naik taraf organisasi atau cipta projek sendiri. Projek aspirasiJPA dan konfigurasi aplikasi semasa dikekalkan aktif sementara menunggu slot.

Apabila projek baharu tersedia: tunggu ACTIVE_HEALTHY, pasang schema.sql dan storage.sql untuk pemasangan khusus kosong, semak Auth/redirect, ambil URL dan kunci awam, kemudian tukar konfigurasi tempatan/produksi kepada projek itu dengan NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT=false. Uji sambungan dan aliran login/onboarding sebelum melaporkan pertukaran selesai. Tiada pemindahan pengguna, kata laluan atau data lama tanpa arahan lanjut.
