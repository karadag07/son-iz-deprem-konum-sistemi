package com.soniz.app.Controller;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.soniz.app.Dto.AreaUpdateRequest;
import com.soniz.app.Dto.LocationRequest;
import com.soniz.app.Dto.UpdateCheckResponse;
import com.soniz.app.Entity.DeviceLocation;
import com.soniz.app.Service.LocationService;

@RestController
@RequestMapping("/api/location")
@CrossOrigin(origins = "*")
public class LocationController {

    private final LocationService locationService;

    public LocationController(LocationService locationService) {
        this.locationService = locationService;
    }

    // Mobil uygulama konum gönderir
    @PostMapping
    public DeviceLocation saveLocation(@RequestBody LocationRequest request) {
        return locationService.saveLocation(request);
    }

    // Frontend panel tüm konumları çeker
    @GetMapping
    public List<DeviceLocation> getAllLocations() {
        return locationService.getAllLocations();
    }

    // Frontend butonu buna basacak
    @PostMapping("/request-update")
    public String requestUpdateFromDevices() {
        locationService.requestUpdateFromAllDevices();
        return "Cihazlardan anlık güncelleme istendi.";
    }

    // Mobil uygulama bunu sürekli kontrol edecek
    @GetMapping("/update-request/{deviceId}")
    public UpdateCheckResponse checkUpdateRequest(@PathVariable String deviceId) {
        boolean requested = locationService.isUpdateRequested(deviceId);
        return new UpdateCheckResponse(requested);
    }

    @PostMapping("/request-update-in-area")
    public String requestUpdateInArea(@RequestBody AreaUpdateRequest request) {
        locationService.requestUpdateInArea(request);
        return "Seçili deprem bölgesindeki cihazlardan güncelleme istendi.";
    }
}