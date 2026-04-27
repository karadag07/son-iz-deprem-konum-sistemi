package com.soniz.app.Dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LocationRequest {

    private String deviceId;
    private Double latitude;
    private Double longitude;
    private Integer batteryLevel;
}