package com.soniz.app.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.soniz.app.Dto.AreaUpdateRequest;
import com.soniz.app.Dto.LocationRequest;
import com.soniz.app.Entity.DeviceLocation;
import com.soniz.app.Repository.LocationRepository;

@Service
public class LocationService {

    private final LocationRepository locationRepository;

    public LocationService(LocationRepository locationRepository) {
        this.locationRepository = locationRepository;
    }

    public void requestUpdateInArea(AreaUpdateRequest request) {
        List<DeviceLocation> locations = locationRepository.findAll();
        LocalDateTime now = LocalDateTime.now();

        for (DeviceLocation location : locations) {
            double distance = calculateDistanceMeters(
                    request.getCenterLatitude(),
                    request.getCenterLongitude(),
                    location.getLatitude(),
                    location.getLongitude());

            if (distance <= request.getRadiusMeters()) {
                location.setUpdateRequested(true);
                location.setLastUpdateRequestAt(now);

                if (location.getLastSuccessfulUpdateAt() == null) {
                    location.setSignalStatus("ORANGE");
                } else {
                    location.setSignalStatus("GREEN");
                }

                locationRepository.save(location);
            }
        }
    }

    private double calculateDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
        final int earthRadius = 6371000;

        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1))
                        * Math.cos(Math.toRadians(lat2))
                        * Math.sin(dLon / 2)
                        * Math.sin(dLon / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return earthRadius * c;
    }

    public DeviceLocation saveLocation(LocationRequest request) {

        Optional<DeviceLocation> optional = locationRepository.findByDeviceId(request.getDeviceId());

        DeviceLocation location;

        if (optional.isPresent()) {
            location = optional.get();
        } else {
            location = new DeviceLocation();
            location.setDeviceId(request.getDeviceId());
        }

        location.setLatitude(request.getLatitude());
        location.setLongitude(request.getLongitude());
        location.setBatteryLevel(request.getBatteryLevel());
        location.setTimestamp(LocalDateTime.now());
        location.setReceivedAt(LocalDateTime.now());

        location.setUpdateRequested(false);
        location.setLastSuccessfulUpdateAt(LocalDateTime.now());
        location.setSignalStatus("GREEN");

        return locationRepository.save(location);

    }

    public List<DeviceLocation> getAllLocations() {
        return locationRepository.findAll();
    }

    public void requestUpdateFromAllDevices() {
        List<DeviceLocation> locations = locationRepository.findAll();

        LocalDateTime now = LocalDateTime.now();

        for (DeviceLocation location : locations) {

            location.setUpdateRequested(true);
            location.setLastUpdateRequestAt(now);

            /*
             * Eğer bu cihaz daha önce mobil uygulamadan gerçekten veri gönderdiyse
             * lastSuccessfulUpdateAt doludur.
             *
             * Yapay verilerde lastSuccessfulUpdateAt null kalacağı için turuncu olur.
             */
            if (location.getLastSuccessfulUpdateAt() == null) {
                location.setSignalStatus("ORANGE");
            } else {
                location.setSignalStatus("GREEN");
            }

            locationRepository.save(location);
        }
    }

    public boolean isUpdateRequested(String deviceId) {
        return locationRepository.findByDeviceId(deviceId)
                .map(location -> Boolean.TRUE.equals(location.getUpdateRequested()))
                .orElse(false);
    }
}