package com.soniz.app.Repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.soniz.app.Entity.DeviceLocation;

public interface LocationRepository extends JpaRepository<DeviceLocation, Long> {

    Optional<DeviceLocation> findByDeviceId(String deviceId);
}