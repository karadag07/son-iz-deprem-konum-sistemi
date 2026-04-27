package com.soniz.app.Config;

import java.time.LocalDateTime;
import java.util.Random;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.soniz.app.Entity.DeviceLocation;
import com.soniz.app.Repository.LocationRepository;

@Component
public class DataSeeder implements CommandLineRunner {

        private final LocationRepository locationRepository;
        private final Random random = new Random();

        public DataSeeder(LocationRepository locationRepository) {
                this.locationRepository = locationRepository;
        }

        @Override
        public void run(String... args) {

                locationRepository.deleteAll();

                int counter = 1;

                // NİĞDE (1000)
                counter = createCluster(counter, "nigde_", 1000,
                                37.9650, 34.6850, 0.020);

                // İSTANBUL (500)
                counter = createCluster(counter, "istanbul_", 500,
                                41.0082, 28.9784, 0.25);

                // LOS ANGELES (500)
                counter = createCluster(counter, "la_", 500,
                                34.0522, -118.2437, 0.35);

                // BERLİN (500)
                counter = createCluster(counter, "berlin_", 500,
                                52.5200, 13.4050, 0.25);

                // KAZAKİSTAN (500)
                counter = createCluster(counter, "kazakhstan_", 500,
                                43.2220, 76.8512, 0.15);

                System.out.println("✔ Toplam 3000 veri oluşturuldu");
        }

        private int createCluster(int start,
                        String prefix,
                        int count,
                        double centerLat,
                        double centerLon,
                        double spread) {

                int counter = start;

                for (int i = 0; i < count; i++) {

                        double lat = centerLat + random.nextGaussian() * spread;
                        double lon = centerLon + random.nextGaussian() * spread;

                        lat = Math.max(-90, Math.min(90, lat));
                        lon = Math.max(-180, Math.min(180, lon));

                        DeviceLocation location = new DeviceLocation();
                        location.setDeviceId(prefix + counter);
                        location.setLatitude(lat);
                        location.setLongitude(lon);
                        location.setBatteryLevel(random.nextInt(81) + 20);
                        location.setTimestamp(LocalDateTime.now().minusMinutes(random.nextInt(240)));
                        location.setReceivedAt(LocalDateTime.now());

                        // 🔥 TEMİZ VE DOĞRU HAL
                        location.setUpdateRequested(false);
                        location.setLastUpdateRequestAt(null);
                        location.setLastSuccessfulUpdateAt(null);
                        location.setSignalStatus("GREEN");

                        locationRepository.save(location);

                        counter++;
                }

                return counter;
        }
}