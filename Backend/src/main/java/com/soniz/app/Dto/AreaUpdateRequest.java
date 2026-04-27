package com.soniz.app.Dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AreaUpdateRequest {
    private Double centerLatitude;
    private Double centerLongitude;
    private Double radiusMeters;
}