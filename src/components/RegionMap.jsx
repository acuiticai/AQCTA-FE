import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Color palette for markers based on count
const getMarkerColor = (count, baseColor) => {
  // If base color is provided, use it; otherwise generate based on count
  if (baseColor && baseColor !== "#3B82F6" && baseColor !== "var(--p-blue)") {
    return baseColor;
  }

  // Color scheme based on count
  if (count === 1) {
    return "#3B82F6"; // Blue for single
  } else if (count === 2) {
    return "#10B981"; // Green for 2
  } else if (count === 3) {
    return "#F59E0B"; // Amber for 3
  } else if (count >= 4 && count <= 5) {
    return "#EF4444"; // Red for 4-5
  } else if (count >= 6 && count <= 10) {
    return "#8B5CF6"; // Purple for 6-10
  } else if (count >= 11 && count <= 20) {
    return "#EC4899"; // Pink for 11-20
  } else {
    return "#F97316"; // Orange for 20+
  }
};

// Get badge color based on count
const getBadgeColor = (count) => {
  if (count >= 10) {
    return "#DC2626"; // Dark red for high counts
  } else if (count >= 5) {
    return "#EF4444"; // Red for medium-high counts
  } else {
    return "#F59E0B"; // Amber for lower counts
  }
};

// Custom marker with count badge and dynamic colors
const createCustomIcon = (baseColor = "#3B82F6", count = 1) => {
  const markerColor = getMarkerColor(count, baseColor);
  const badgeColor = getBadgeColor(count);
  const showBadge = count > 1;
  const badgeSize = count > 99 ? "18px" : "20px";
  const fontSize = count > 99 ? "10px" : "11px";

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        position: relative;
        width: ${showBadge ? "32px" : "24px"};
        height: ${showBadge ? "32px" : "24px"};
      ">
        <div style="
          background: linear-gradient(135deg, ${markerColor} 0%, ${markerColor}dd 100%);
          width: 24px;
          height: 24px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          position: absolute;
          top: 0;
          left: 0;
        ">
          <div style="
            width: 8px;
            height: 8px;
            background-color: white;
            border-radius: 50%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(45deg);
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
          "></div>
        </div>
        ${
          showBadge
            ? `
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            background: linear-gradient(135deg, ${badgeColor} 0%, ${badgeColor}dd 100%);
            color: white;
            border-radius: 50%;
            width: ${badgeSize};
            height: ${badgeSize};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: ${fontSize};
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            z-index: 1000;
            animation: pulse 2s infinite;
          ">${count > 99 ? "99+" : count}</div>
        `
            : ""
        }
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      </style>
    `,
    iconSize: showBadge ? [32, 32] : [24, 24],
    iconAnchor: showBadge ? [16, 32] : [12, 24],
    popupAnchor: [0, showBadge ? -32 : -24],
  });
};

// Component to fit bounds when markers change
const FitBounds = ({ groupedMarkers }) => {
  const map = useMap();

  useEffect(() => {
    if (groupedMarkers && groupedMarkers.length > 0) {
      const validMarkers = groupedMarkers.filter(
        (m) => m.coordinates?.lat && m.coordinates?.lng
      );

      if (validMarkers.length > 0) {
        const bounds = L.latLngBounds(
          validMarkers.map((m) => [m.coordinates.lat, m.coordinates.lng])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    }
  }, [groupedMarkers, map]);

  return null;
};

const RegionMap = ({
  data = [],
  height = "650px",
  markerColor = "#3B82F6",
  title = "Map View",
}) => {
  // Filter data with valid coordinates
  const validMarkers = useMemo(() => {
    return data.filter(
      (item) =>
        item.coordinates?.lat &&
        item.coordinates?.lng &&
        !isNaN(item.coordinates.lat) &&
        !isNaN(item.coordinates.lng)
    );
  }, [data]);

  // Group markers by coordinates (same location = same region)
  const groupedMarkers = useMemo(() => {
    const groups = new Map();

    validMarkers.forEach((item) => {
      // Create a key based on rounded coordinates (to group nearby items)
      const lat = parseFloat(item.coordinates.lat).toFixed(4);
      const lng = parseFloat(item.coordinates.lng).toFixed(4);
      const key = `${lat},${lng}`;

      if (!groups.has(key)) {
        groups.set(key, {
          coordinates: {
            lat: parseFloat(item.coordinates.lat),
            lng: parseFloat(item.coordinates.lng),
          },
          items: [],
          region: item.region || "Unknown",
        });
      }

      groups.get(key).items.push(item);
    });

    return Array.from(groups.values());
  }, [validMarkers]);

  // Calculate center point
  const center = useMemo(() => {
    if (groupedMarkers.length === 0) {
      return [20, 0]; // Default world center
    }

    const avgLat =
      groupedMarkers.reduce((sum, m) => sum + m.coordinates.lat, 0) /
      groupedMarkers.length;
    const avgLng =
      groupedMarkers.reduce((sum, m) => sum + m.coordinates.lng, 0) /
      groupedMarkers.length;

    return [avgLat, avgLng];
  }, [groupedMarkers]);

  if (groupedMarkers.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
        style={{ height }}
      >
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">
            No location data available. Add region information to see items on
            the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative" style={{ height }}>
      <style>{`
        /* Ensure map labels and our popups use English font rendering */
        .leaflet-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        }
        /* Add vibrant colors to map tiles - enhance saturation and contrast */
        .leaflet-tile-container img {
          filter: brightness(1.05) saturate(1.2) contrast(1.05);
          transition: filter 0.2s ease;
        }
        /* Make water bodies proper ocean blue color - deep ocean blue */
        .leaflet-tile-container img[src*="cartocdn"] {
          filter: brightness(0.9) saturate(1.8) contrast(1.3) hue-rotate(-20deg);
        }
        /* Enhance map container background with deep ocean blue */
        .leaflet-container {
          background: linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0c4a6e 100%);
        }
        /* Additional styling for water areas - enhance blue tones */
        .leaflet-tile-pane {
          mix-blend-mode: normal;
        }
        /* Target water areas specifically for ocean blue */
        .leaflet-tile-container img[src*="cartocdn"]:hover {
          filter: brightness(0.9) saturate(1.8) contrast(1.3) hue-rotate(-20deg);
        }
        /* Style for our custom popups - always English */
        .leaflet-popup-content-wrapper {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        }
        /* Color legend styling */
        .map-color-legend {
          position: absolute;
          top: 10px;
          right: 10px;
          background: white;
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 1000;
          font-size: 12px;
          max-width: 200px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
        }
        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid white;
          margin-right: 8px;
          flex-shrink: 0;
        }
      `}</style>

      <MapContainer
        center={center}
        zoom={3}
        style={{ height: "100%", width: "100%", borderRadius: "8px" }}
        scrollWheelZoom={true}
      >
        {/* Use CartoDB Voyager - colorful and vibrant map style */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        <FitBounds groupedMarkers={groupedMarkers} />
        {groupedMarkers.map((group, index) => {
          const count = group.items.length;
          const isMultiple = count > 1;
          // Use dynamic color based on count, but respect the base markerColor if it's custom
          const dynamicColor = getMarkerColor(count, markerColor);

          return (
            <Marker
              key={`${group.coordinates.lat}-${group.coordinates.lng}-${index}`}
              position={[group.coordinates.lat, group.coordinates.lng]}
              icon={createCustomIcon(dynamicColor, count)}
            >
              <Popup maxWidth={400}>
                <div className="p-3 min-w-[250px] max-w-[400px]">
                  <div className="mb-3 pb-2 border-b border-gray-200">
                    <h3 className="font-bold text-lg text-gray-900">
                      {isMultiple
                        ? `${group.region} Region`
                        : group.items[0].name}
                    </h3>
                    {isMultiple && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span
                          className="font-semibold px-2 py-1 rounded"
                          style={{
                            backgroundColor: getBadgeColor(count) + "20",
                            color: getBadgeColor(count),
                            border: `1px solid ${getBadgeColor(count)}40`,
                          }}
                        >
                          {count}
                        </span>{" "}
                        {title.toLowerCase().includes("customer")
                          ? "customers"
                          : "vendors"}{" "}
                        in this region
                      </p>
                    )}
                    {!isMultiple && group.region && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Region:</span>{" "}
                        {group.region}
                      </p>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {group.items.map((item, itemIndex) => (
                      <div
                        key={item.id || itemIndex}
                        className={`mb-3 ${
                          itemIndex < group.items.length - 1
                            ? "pb-3 border-b border-gray-100"
                            : ""
                        }`}
                      >
                        <h4 className="font-semibold text-base text-gray-900 mb-2">
                          {item.name}
                        </h4>
                        {item.region && isMultiple && (
                          <p className="text-xs text-gray-500 mb-1">
                            <span className="font-medium">Region:</span>{" "}
                            {item.region}
                          </p>
                        )}
                        {item.email && (
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">Email:</span>{" "}
                            <a
                              href={`mailto:${item.email}`}
                              className="text-blue-600 hover:underline"
                            >
                              {item.email}
                            </a>
                          </p>
                        )}
                        {item.phone && (
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">Phone:</span>{" "}
                            <a
                              href={`tel:${item.phone}`}
                              className="text-blue-600 hover:underline"
                            >
                              {item.phone}
                            </a>
                          </p>
                        )}
                        {item.type && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Type:</span>{" "}
                            <span
                              className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: item.type
                                  .toLowerCase()
                                  .includes("internal")
                                  ? "#3B82F6" + "20"
                                  : "#10B981" + "20",
                                color: item.type
                                  .toLowerCase()
                                  .includes("internal")
                                  ? "#3B82F6"
                                  : "#10B981",
                                border: `1px solid ${
                                  item.type.toLowerCase().includes("internal")
                                    ? "#3B82F6"
                                    : "#10B981"
                                }40`,
                              }}
                            >
                              {item.type}
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default RegionMap;
