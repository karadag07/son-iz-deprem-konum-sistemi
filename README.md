# Son İz - Afet Konum ve Önceliklendirme Sistemi

Son İz, deprem öncesi ve sonrası kullanıcı konumlarını takip ederek afet anında arama kurtarma ekiplerine veri sağlayan ve yıkım noktalarını önceliklendiren bir sistemdir.

## Proje Amacı

Deprem sonrası GSM ve internet altyapısının çökmesi durumunda, insanların konum bilgilerine ulaşmak zorlaşır.
Bu proje:

* Deprem öncesinde kullanıcı konumlarını periyodik olarak kaydeder
* Deprem sonrasında son bilinen konumları gösterir
* İnternete erişebilen cihazlardan anlık konum güncellemesi alır
* Yıkım noktalarını analiz ederek önceliklendirme (skorlama) yapar

Amaç, arama kurtarma ekiplerinin en kritik noktalara önce ulaşmasını sağlamaktır.

---

## Sistem Nasıl Çalışır?

### Mobil Uygulama (Android)

* Kullanıcı konumu belirli aralıklarla (örneğin 30 dakika) sunucuya gönderilir
* Her cihaz için veritabanında tek konum tutulur (upsert mantığı)
* Yeni konum geldikçe eski konum güncellenir

### Backend (Spring Boot)

* REST API ile konum verileri alınır
* Her cihaz için tek kayıt tutulur
* Admin panelinden gelen isteklerle belirli bölgelerdeki cihazlara konum güncelleme isteği gönderilebilir

### Frontend (React - Admin Panel)

* Harita üzerinde kullanıcı konumları görüntülenir
* Yıkım noktaları işaretlenir
* AFAD veya yetkili ekiplerden gelen bilgiler sisteme girilir:

  * Bina adı
  * Mahalle
  * Açıklama

### Yıkım Noktası Skorlama Sistemi

* Her yıkım noktası için bir skor hesaplanır
* Skor, o bölgedeki kullanıcı yoğunluğuna göre belirlenir
* Daha fazla insanın bulunduğu noktalar öncelikli hale getirilir

En yüksek skorlu noktalar listede en üstte gösterilir ve bu sayede arama kurtarma ekipleri önceliklendirme yapabilir.

---

## Proje Mimarisi

```text
Android App  →  Spring Boot API  →  Database
                     ↓
               React Admin Panel
```

---

## Kullanılan Teknolojiler

### Backend

* Java
* Spring Boot
* REST API
* JPA / Hibernate

### Frontend

* React
* TypeScript
* Vite

### Mobile

* Kotlin (Android)
* FusedLocationProviderClient

### Diğer

* OkHttp (mobil ve backend iletişimi)
* JSON veri formatı
* Harita tabanlı analiz

---

## Öne Çıkan Özellikler

* Gerçek zamanlı ve son bilinen konum takibi
* Upsert mantığı ile tek kayıtlı cihaz sistemi
* Afet senaryosuna özel tasarım
* Yıkım noktası önceliklendirme algoritması
* Harita tabanlı admin panel
* Bağlantı durumuna göre veri güncelleme

---

## Senaryo

1. Deprem öncesinde kullanıcı uygulamayı kullanır
2. Konumlar periyodik olarak sunucuya kaydedilir
3. Deprem sonrasında:

   * İnterneti olan cihazlar anlık konum gönderir
   * İnterneti olmayan cihazlar son konumdan takip edilir
4. Admin panelde yıkım noktaları girilir
5. Sistem en kritik bölgeleri belirler
6. Arama kurtarma ekipleri bu verilere göre yönlendirilir

---

## Hedef

Bu sistem, afet anında zaman kaybını azaltmayı, kaynakları doğru yönlendirmeyi ve daha fazla hayat kurtarmaya katkı sağlamayı hedefler.

