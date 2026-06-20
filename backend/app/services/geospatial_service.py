"""Geospatial validation for Sri Lanka scenario assessments."""

from functools import lru_cache
from typing import Any

from fastapi import HTTPException, status


SRI_LANKA_BOUNDARY = [
    (79.55, 5.85),
    (80.05, 5.78),
    (80.75, 5.88),
    (81.45, 6.15),
    (81.88, 6.55),
    (82.05, 7.25),
    (81.92, 8.05),
    (81.55, 8.75),
    (80.95, 9.55),
    (80.25, 9.9),
    (79.65, 9.8),
    (79.35, 9.25),
    (79.55, 8.35),
    (79.65, 7.45),
    (79.45, 6.75),
]


class SriLankaBoundaryService:
    def boundary_geojson(self) -> dict[str, Any]:
        coordinates = [[list(point) for point in SRI_LANKA_BOUNDARY + [SRI_LANKA_BOUNDARY[0]]]]
        return {
            "type": "Feature",
            "properties": {"name": "Sri Lanka scenario boundary"},
            "geometry": {"type": "Polygon", "coordinates": coordinates},
        }

    def contains(self, latitude: float, longitude: float) -> bool:
        return _point_in_polygon(longitude, latitude, SRI_LANKA_BOUNDARY)

    def require_inside(self, latitude: float, longitude: float) -> None:
        if not self.contains(latitude, longitude):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": "Scenario coordinates must be inside Sri Lanka.",
                    "latitude": latitude,
                    "longitude": longitude,
                },
            )


def _point_in_polygon(x: float, y: float, polygon: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i, point in enumerate(polygon):
        xi, yi = point
        xj, yj = polygon[j]
        intersects = (yi > y) != (yj > y) and x < ((xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi)
        if intersects:
            inside = not inside
        j = i
    return inside


@lru_cache(maxsize=1)
def get_boundary_service() -> SriLankaBoundaryService:
    return SriLankaBoundaryService()
