# Afet Konum Kasası - Panel Only v9

Bu sürüm, panel ve analiz backend'ini `app.zip` içindeki Spring Boot uygulamasının kullandığı PostgreSQL veritabanına bağlar.

## Veritabanı bağlantısı

`app.zip` içinde görülen Spring Boot ayarı:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/postgres
spring.datasource.username=postgres
spring.datasource.password=1
```

Panel backend varsayılan olarak aynı PostgreSQL veritabanından şu tabloyu okur:

```text
device_locations
```

Beklenen kolonlar:

```text
id
device_id
latitude
longitude
battery_level
timestamp
received_at
```

Panel artık dünya geneli demo konumları ana veri olarak kullanmaz. Konumlar PostgreSQL `device_locations` tablosundan okunur. Admin kullanıcıları, afet olayları, manuel hasar/yıkım girdileri, audit log ve analiz sonuçları bu MVP sürümünde hâlâ backend RAM belleğinde tutulur.

## Önemli davranış

- Haritada cihaz verileri PostgreSQL'den gelir.
- Deprem/afet bölgesini panelden sen belirlersin.
- “Cihazlardan Anlık Güncelleme İste” sadece seçili afet bölgesindeki cihazları hedefler.
- Mobil push henüz olmadığı için bu buton PostgreSQL'e yeni veri yazmaz.
- Yeni veri gelmesi için mobil/Spring Boot uygulamasının `device_locations` tablosunu güncellemesi gerekir.
- Hasar/yıkım bilgisi otomatik üretilmez; sadece panel kullanıcısının haritadan manuel işaretlediği alanlar analiz edilir.

## Hızlı kontrol

Backend çalışınca:

```text
http://localhost:4000/health
```

Burada `database.ok: true` görünmelidir.

Panel girişinden sonra API ile veritabanı durumu:

```text
GET /api/admin/database/status
POST /api/admin/database/refresh
```


---

# Afet Konum Kasası — Panel + Dünya Demo Analiz MVP v7

Bu paket mobil uygulamayı içermez. Odak sadece backend, admin panel, harita ve analiz akışıdır.

## v7 Değişiklikleri

- Demo cihaz verileri dünya geneline dağıtıldı.
- Panel kullanıcısı deprem/afet bölgesini haritadan kendisi belirleyebilir.
- Dünya geneli demo cihazlar gri, küçük noktalarla gösterilir.
- Seçili deprem bölgesi içindeki cihazlar ayrıca sınıflandırılır:
  - Yeşil: Afet sonrası veri güncellendi.
  - Sarı: Afet sonrası veri güncellenmedi.
  - Gri: Seçili afet alanı dışında kalan dünya demo verisi.
- Hasar/yıkım bilgisi otomatik üretilmez.
- Hasar/yıkım girişi sadece Harita Analiz ekranından manuel yapılır.
- Analiz yalnızca seçili deprem bölgesi ve manuel hasar/yıkım girdileri üzerinden çalışır.
- Düşük güven katmanı yoktur.
- Panelden “Cihazlardan Anlık Güncelleme İste” butonu eklendi.
- Panel-only demoda bu istek kaydedilir ve erişilebilir bazı demo cihazların afet sonrası veri güncellemesi simüle edilir.
- Öncelikli kontrol alanlarında adres/alan bilgisi gösterilir.
- Öncelikli kontrol alanları varsayılan olarak en yüksek skordan en düşüğe sıralanır.
- Skor sistemi düzeltildi: sadece hasar/yıkım işaretlemek artık otomatik yüksek skor üretmez.

## Çalıştırma

### Backend

```powershell
cd "C:\Users\doguk\Documents\hackathon\afet-konum-kasasi-panel-only-v7\backend"
npm install
npm run dev
```

Backend adresi:

```text
http://localhost:4000
```

Kontrol:

```text
http://localhost:4000/health
```

### Admin Panel

Yeni PowerShell aç:

```powershell
cd "C:\Users\doguk\Documents\hackathon\afet-konum-kasasi-panel-only-v7\admin-panel"
npm install
npm run dev
```

Panel adresi:

```text
http://localhost:5173
```

## Demo Kullanıcılar

```text
super@demo.com / Demo123!
operation@demo.com / Demo123!
viewer@demo.com / Demo123!
```

## Önerilen Demo Akış

1. Admin panele giriş yap.
2. Harita Analiz ekranını aç.
3. Dünya geneli gri demo cihaz noktalarını gör.
4. Deprem Bölgesi Belirle butonuna bas.
5. Haritada istediğin şehir/bölge merkezine tıkla.
6. Yarıçapı düzenle.
7. Deprem Bölgesini Oluştur butonuna bas.
8. Seçili bölge içinde yeşil/sarı cihaz ayrımını gör.
9. Hasar/Yıkım Gir butonuna bas.
10. Seçili afet alanı içinde doğrulanmış hasar/yıkım noktasını manuel işaretle.
11. Girdiyi kaydet.
12. İstersen Cihazlardan Anlık Güncelleme İste butonuna bas.
13. Analiz Çalıştır butonuna bas.
14. Öncelikli Kontrol Alanları ekranında adresleri ve öncelik sıralamasını incele.

## Kritik Tasarım Kuralı

Bu MVP:

- otomatik yıkılmış bina tespiti yapmaz,
- kesin kişi durumu üretmez,
- canlı kişi takibi yapmaz,
- rota geçmişi tutmaz,
- sadece son güvenilir konum kayıtları ve manuel hasar/yıkım girdileriyle alan bazlı kontrol önerisi üretir.

Paneldeki analiz sonucu “kişinin kesin durumu” değil, saha ekiplerinin kontrol önceliği için karar destek çıktısıdır.


## v8 Değişiklikleri

- `Cihazlardan Anlık Güncelleme İste` butonu gerçek mobil push altyapısı olmadığı için cihazları güncellemiş gibi simüle etmez.
- Demo ortamında bu buton hedef cihazların yanıt vermediğini kaydeder ve seçili afet alanındaki demo cihazları `Afet sonrası veri güncellenmedi` kategorisinde tutar.
- Öncelikli kontrol alanları ekranındaki ek sıralama seçenekleri kaldırıldı. Liste her zaman aciliyet/arama önceliği skoruna göre yüksekten düşe sıralanır.
- Sistem kesin kişi durumu üretmez; sadece alan bazlı kontrol önceliği verir.
