# Panduan deployment dan migrasi PostgreSQL EssAI

Dokumen ini menjelaskan cara menyiapkan database untuk deployment lomba. **Migrasi belum dijalankan terhadap database produksi**; jalankan langkah berikut setelah kamu membuat database PostgreSQL dan memiliki connection string-nya.

## Pilih cara menyiapkan data

Ada dua pilihan:

- **Memindahkan data lokal:** gunakan pilihan ini bila file SQLite kamu berisi akun, ujian, jawaban, nilai, atau protes yang ingin dipertahankan.
- **Mulai dengan database baru:** lewati migrasi dan buat akun demo serta kelas demo menggunakan skrip seed. Pilihan ini cocok bila data lokal tidak perlu dibawa ke website lomba.

Jangan jalankan seeding pada database tujuan sebelum migrasi data lokal. Skrip migrasi sengaja menolak database tujuan yang sudah berisi data agar data tidak tercampur.

## 1. Siapkan PostgreSQL

Buat database PostgreSQL terkelola, misalnya di Neon. Salin connection string dari penyedia database dan simpan secara privat. Untuk aplikasi serverless, gunakan alamat koneksi dengan connection pooling bila penyedia menyediakannya. Connection string biasanya menyertakan opsi SSL.

Jangan mengirim connection string, kata sandi database, kunci Gemini, atau `APP_SECRET_KEY` ke chat maupun GitHub.

## 2. Pasang dependensi backend

Jalankan PowerShell dari folder project:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Jika virtual environment belum tersedia, buat dan aktifkan terlebih dahulu:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 3A. Pindahkan SQLite ke PostgreSQL

Pastikan backend lokal berhenti, lalu pastikan file SQLite sumber benar-benar ada. Contoh di bawah mengasumsikan file berada di `backend\essay_scoring.db` dan perintah dijalankan dari folder `backend`.

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
python -m app.migrate_sqlite_to_postgres --source .\essay_scoring.db
python -m app.seed_users
```

Ganti nilai contoh pada URL dengan connection string asli dari penyedia database. Bila URL dari penyedia sudah menyertakan parameter koneksi, gunakan URL tersebut apa adanya.

Skrip migrasi:

- hanya menerima tujuan PostgreSQL;
- mengharuskan tabel aplikasi tujuan kosong;
- memeriksa agar tabel yang sudah ada tidak kekurangan kolom;
- memindahkan data dari tabel SQLite yang cocok dengan model saat ini, mempertahankan ID, lalu menyelaraskan sequence ID PostgreSQL;
- tidak mengubah file SQLite sumber.

Periksa ringkasan jumlah baris yang ditampilkan setelah migrasi. Bila skrip berhenti karena tabel tujuan tidak kosong atau skemanya tidak sesuai, **jangan menghapus data secara membabi buta**. Buat database PostgreSQL baru yang kosong untuk migrasi awal, atau tinjau skema tujuan terlebih dahulu.

Setelah seeding selesai, catat kode kelas demo dari keluaran perintah atau lihat halaman **Kelola kelas** setelah masuk sebagai guru.

## 3B. Mulai dari database PostgreSQL kosong

Bila kamu tidak perlu memindahkan data SQLite, jalankan dari folder `backend` dengan `DATABASE_URL` tujuan yang sudah diatur:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
python -m app.seed_users
```

Perintah seeding membuat tabel yang dibutuhkan, akun demo guru dan siswa, serta kelas demo. Variabel `DEMO_TEACHER_*` dan `DEMO_STUDENT_*` harus berisi email dan kata sandi yang ingin dipakai. Kata sandi demo minimum 12 karakter.

Jika akun demo sudah ada di database, seeder tidak mengganti kata sandinya. Pastikan kredensial di konfigurasi cocok dengan akun yang sudah dimigrasikan.

## 4. Konfigurasi layanan produksi

Atur variabel berikut pada konfigurasi environment backend di layanan hosting:

| Variabel | Kegunaan |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL produksi |
| `GEMINI_API_KEY` | Kunci API untuk penilaian esai |
| `GEMINI_MODEL` | Model Gemini utama; gunakan model yang tersedia di project |
| `GEMINI_FALLBACK_MODELS` | Daftar model cadangan, dipisahkan koma |
| `APP_SECRET_KEY` | Kunci acak panjang untuk menandatangani cookie sesi |
| `APP_COOKIE_SECURE` | Set ke `true` pada deployment HTTPS |
| `CORS_ORIGINS` | Asal frontend yang diizinkan bila frontend dan backend berbeda domain |

Jangan menyimpan nilai rahasia di `vercel.json`, kode frontend, variabel berawalan `NEXT_PUBLIC_`, ataupun repository.

File `vercel.json` di root project mengarahkan request `/api/...` ke FastAPI dan path lainnya ke Next.js. Untuk konfigurasi ini, biarkan `NEXT_PUBLIC_API_URL` tidak diatur sehingga frontend menggunakan alamat API relatif. Vercel Services saat ini berstatus Beta; bila fitur tersebut tidak tersedia pada project kamu atau deployment Services gagal, deploy frontend dan backend sebagai layanan terpisah. Jika API berada di domain terpisah, isi `NEXT_PUBLIC_API_URL` dengan alamat API dan atur `CORS_ORIGINS` pada backend ke origin frontend yang tepat.

Setelah seeding lokal selesai, hapus connection string dari sesi PowerShell jika tidak ingin variabel itu tetap aktif:

```powershell
Remove-Item Env:DATABASE_URL
```

Perintah ini menghapus variabel hanya dari sesi terminal yang sedang dibuka, bukan dari konfigurasi layanan hosting.

## 5. Uji sebelum mengirim tautan ke juri

Pastikan semua alur ini berhasil pada deployment publik:

1. Masuk sebagai guru dengan akun demo.
2. Buat kelas dan salin kode undangan.
3. Daftar sebagai siswa baru menggunakan kode tersebut; pastikan siswa tidak dapat memilih role guru.
4. Buat ujian untuk kelas itu, lalu masuk sebagai siswa dan kirim esai.
5. Periksa nilai akhir, umpan balik, riwayat jawaban, dan statistik siswa/kelas.
6. Ajukan protes dari akun siswa dan tinjau dari akun guru. Periksa bahwa protes menampilkan identitas siswa, kelas, serta ujian yang benar.
7. Muat ulang layanan atau lakukan deployment ulang, lalu pastikan data tetap tersedia.

`Base.metadata.create_all()` membuat tabel yang belum ada, tetapi bukan pengganti sistem migrasi skema umum. Skrip ini ditujukan untuk migrasi awal SQLite ke database PostgreSQL kosong. Setelah data produksi mulai digunakan, gunakan proses migrasi skema eksplisit dan jangan jalankan skrip migrasi awal berulang kali.
