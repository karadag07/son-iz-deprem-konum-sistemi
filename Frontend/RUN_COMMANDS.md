# Çalıştırma Komutları - v9 PostgreSQL Bağlantılı Sürüm

## 1. Önce PostgreSQL ve app.zip backend'i çalışır durumda olmalı

`app.zip` içindeki Spring Boot uygulaması şu veritabanını kullanıyor:

```text
localhost:5432/postgres
postgres / 1
```

`device_locations` tablosunda kayıt olmalı.

## 2. Panel backend

```powershell
cd "C:\Users\doguk\Documents\hackathon\afet-konum-kasasi-panel-only-v9\backend"
npm install
npm run dev
```

Kontrol:

```text
http://localhost:4000/health
```

`database.ok` true olmalı.

## 3. Admin panel

Yeni PowerShell:

```powershell
cd "C:\Users\doguk\Documents\hackathon\afet-konum-kasasi-panel-only-v9\admin-panel"
npm install
npm run dev
```

Panel:

```text
http://localhost:5173
```

## 4. Demo admin

```text
super@demo.com / Demo123!
operation@demo.com / Demo123!
viewer@demo.com / Demo123!
```

## 5. Test akışı

```text
1. PostgreSQL içinde device_locations tablosunda konum kaydı olduğundan emin ol.
2. Backend'i başlat.
3. /health ekranında database.ok true gör.
4. Panelden giriş yap.
5. Harita Analiz ekranında PostgreSQL'den gelen cihaz noktalarını gör.
6. Deprem bölgesi belirle.
7. Hasar/Yıkım Gir ile manuel nokta ekle.
8. Analiz Çalıştır.
9. Öncelikli Kontrol Alanları ekranında aciliyete göre sıralı listeyi kontrol et.
```
