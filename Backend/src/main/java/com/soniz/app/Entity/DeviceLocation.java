package com.soniz.app.Entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "device_locations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DeviceLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String deviceId;

    private Double latitude;
    private Double longitude;
    private Integer batteryLevel;

    private LocalDateTime timestamp;
    private LocalDateTime receivedAt;

    // Panel update isteyince true olur
    private Boolean updateRequested = false;

    // Panelin en son ne zaman güncelleme istediği
    private LocalDateTime lastUpdateRequestAt;

    // Mobil gerçekten konum gönderirse dolar
    private LocalDateTime lastSuccessfulUpdateAt;

    // GREEN / ORANGE
    private String signalStatus = "GREEN";
}