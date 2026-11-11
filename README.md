# Busur — web skor panahan

Busur adalah aplikasi publik untuk mencatat, melihat, dan membandingkan skor pertandingan panahan. Semua pengunjung dapat menambah dan menghapus pertandingan.

## Deploy ke Netlify

1. Push seluruh proyek ini ke repository GitHub.
2. Di Netlify, pilih **Add new site → Import an existing project**, lalu hubungkan repository tersebut.
3. Biarkan pengaturan build menggunakan `netlify.toml`: folder publish `public` dan functions di `netlify/functions`. Build command tidak diperlukan.
4. Deploy, lalu buka URL yang diberikan Netlify.

Versi Netlify menggunakan halaman statis di `public/`, Netlify Functions untuk API, dan Netlify Blobs untuk menyimpan pertandingan bersama. Data lama dari MySQL/XAMPP tidak ikut dipindahkan otomatis.

**Penting:** semua pengunjung dapat mencatat dan menghapus pertandingan. Gunakan hanya jika perubahan oleh publik memang diperbolehkan.
