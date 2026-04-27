# PostgreSQL Entegrasyonu

Bu paket, `app.zip` içindeki Spring Boot uygulamasının yazdığı PostgreSQL tablosundan konum okur.

## app.zip içinde tespit edilen ayar

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/postgres
spring.datasource.username=postgres
spring.datasource.password=1
```

## Okunan tablo

```sql
select
  id,
  device_id,
  latitude,
  longitude,
  battery_level,
  timestamp,
  received_at
from device_locations
```

## Bağlantı ayarları

`backend/.env.example` içindeki değerler:

```env
DATA_SOURCE=postgres
PGHOST=localhost
PGPORT=5432
PGDATABASE=postgres
PGUSER=postgres
PGPASSWORD=1
LOCATION_TABLE=device_locations
```

## Kontrol SQL'i

PostgreSQL içinde:

```sql
select count(*) from device_locations;

select *
from device_locations
order by received_at desc nulls last, timestamp desc nulls last
limit 20;
```

## Panel davranışı

- Panel haritadaki cihaz noktalarını bu tablodan okur.
- Afet bölgesi seçilmeden küresel güncelleme isteği gönderilmez.
- “Cihazlardan Anlık Güncelleme İste” seçili afet bölgesi içindeki cihaz sayısını hesaplar.
- Mobil push henüz olmadığı için panel bu tabloya yeni veri yazmaz.
- Yeni cihaz konumu gelirse Spring Boot uygulaması aynı `device_locations` satırını günceller; panel sonraki okumada bunu görür.

## Hata durumları

`http://localhost:4000/health` içinde `database.ok: false` görünürse:

1. PostgreSQL çalışıyor mu?
2. Port doğru mu? Varsayılan: `5432`
3. Kullanıcı/şifre doğru mu? Varsayılan: `postgres / 1`
4. `device_locations` tablosu oluştu mu?
5. app.zip Spring Boot uygulaması en az bir konum kaydı aldı mı?

