# SIRKALOKA

Website aplikasi untuk manajemen budidaya maggot / pengelolaan sampah organik dengan integrasi Google OAuth, Google Sheets, dan IoT monitoring.

## Persiapan lokal

1. Install dependency:
   npm install
2. Copy file `.env.example` menjadi `.env.local`.
3. Isi nilai berikut:
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_REDIRECT_URI
   - SECRET_KEY
4. Jalankan aplikasi:
   npm run dev

Aplikasi akan berjalan di http://localhost:3000

## Deploy ke GitHub

1. Pastikan repo sudah terhubung ke GitHub.
2. Commit semua perubahan:
   git add .
   git commit -m "Prepare Vercel deployment"
3. Push ke GitHub:
   git push origin main

> Jika branch default repo adalah `master`, ganti `main` sesuai branch Anda.

## Deploy ke Vercel

1. Buka https://vercel.com dan login.
2. Pilih `Add New Project`.
3. Import repo GitHub ini.
4. Gunakan konfigurasi default Next.js:
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. Pada bagian project name, gunakan `sirkaloka` agar domain default Vercel menjadi:
   - https://sirkaloka.vercel.app
6. Tambahkan environment variables di Vercel Project Settings:
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_REDIRECT_URI=https://sirkaloka.vercel.app/api/oauth2callback
   - SECRET_KEY=nilai-random-yang-aman
7. Deploy.

Jika Anda nanti punya custom domain sendiri, tinggal mengganti URL redirect ke domain baru tersebut.

## Catatan penting

- Aplikasi ini menggunakan Google OAuth untuk login admin.
- File `central_db.json` dan `.env.local` sengaja diabaikan agar tidak ikut ke GitHub.
- Untuk Vercel, pastikan semua secret disimpan di environment variables project, bukan di file lokal.
- Karena Vercel adalah serverless, data yang disimpan di filesystem lokal bisa bersifat sementara. Untuk produksi yang lebih stabil, pertimbangkan migrasi ke database seperti Supabase, Neon, atau Vercel KV.

## Verifikasi build

Saat repo sudah siap, perintah berikut harus sukses:

npm run build
