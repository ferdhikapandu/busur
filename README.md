# Busur — web skor panahan

Busur adalah web publik untuk mencatat dan melihat skor panahan. Tidak ada akun admin atau halaman login; siapa saja dapat mencatat pertandingan, menghapus pertandingan dari halaman Riwayat, dan melihat skor serta peringkat. Penghapusan pertandingan juga menghapus semua data pemanah dan skor terkait secara permanen.

## Menjalankan lewat XAMPP

1. Salin folder proyek ke `C:\xampp\htdocs\busur`.
2. Buka XAMPP Control Panel, lalu jalankan **Apache** dan **MySQL**.
3. Buka `http://localhost/phpmyadmin`.
4. Pilih tab **Import**, lalu impor file `database.sql` dari folder proyek.
5. Periksa `config.php`. Konfigurasi bawaan cocok untuk instalasi XAMPP standar (`root`, tanpa kata sandi). Sesuaikan jika MySQL Anda memakai kredensial berbeda.
6. Buka `http://localhost/busur`.

Untuk peserta di jaringan Wi-Fi yang sama, bagikan alamat IP komputer yang menjalankan XAMPP, misalnya `http://192.168.1.10/busur`. Peserta tidak bisa memakai `localhost` dari perangkat mereka sendiri. Akses jaringan juga bergantung pada pengaturan firewall Windows.

Skor disimpan di database MySQL, bukan di browser. Karena pencatatan pertandingan tersedia untuk semua pengunjung, bagikan alamat web hanya kepada orang yang Anda percaya.
