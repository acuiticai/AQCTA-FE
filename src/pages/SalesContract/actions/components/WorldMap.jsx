import React, { useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Graticule,
} from 'react-simple-maps';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

const WorldMap = ({ data = [], className = "" }) => {
  console.log("WorldMap received data:", data);

  // Enhanced country name mapping with more variations
  const countryNameMap = {
    'indonesia': ['indonesia', 'republic of indonesia', 'id', 'idn'],
    'australia': ['australia', 'commonwealth of australia', 'au', 'aus'],
    'malaysia': ['malaysia', 'mys', 'my'],
    'thailand': ['thailand', 'kingdom of thailand', 'th', 'tha'],
    'japan': ['japan', 'jpn', 'jp'],
    'jepang': ['japan', 'jpn', 'jp'],
    'usa': ['united states of america', 'united states', 'usa', 'us', 'america'],
    'united states': ['united states of america', 'united states', 'usa', 'us'],
    'china': ['china', "people's republic of china", 'cn', 'chn'],
    'india': ['india', 'republic of india', 'in', 'ind'],
    'singapore': ['singapore', 'republic of singapore', 'sg', 'sgp'],
    'brazil': ['brazil', 'federative republic of brazil', 'br', 'bra']
  };

  // Create enhanced country data map
  const countryDataMap = useMemo(() => {
    const map = {};
    
    data.forEach((item) => {
      const dataCountryName = item.name.toLowerCase().trim();
      console.log(`Processing data for: "${dataCountryName}" with value: ${item.value}%`);
      
      // Add the original name
      map[dataCountryName] = item;
      
      // Add all possible variations
      const variations = countryNameMap[dataCountryName] || [dataCountryName];
      variations.forEach(variation => {
        map[variation.toLowerCase()] = item;
        console.log(`Added mapping: "${variation.toLowerCase()}" -> ${item.value}%`);
      });
    });
    
    console.log("Final country data map:", map);
    return map;
  }, [data]);

  // Improved country matching with extensive logging
  const findCountryData = (geo) => {
    const possibleNames = [
      geo.properties.NAME,
      geo.properties.NAME_EN, 
      geo.properties.ADMIN,
      geo.properties.NAME_LONG,
      geo.properties.FORMAL_EN,
      geo.properties.NAME_SORT,
      geo.properties.ISO_A2,
      geo.properties.ISO_A3,
      geo.properties.ADM0_A3
    ].filter(Boolean);

    // Try exact match first
    for (let name of possibleNames) {
      const normalizedName = name.toLowerCase().trim();
      if (countryDataMap[normalizedName]) {
        console.log(`✅ EXACT MATCH found for "${name}" -> ${countryDataMap[normalizedName].value}%`);
        return countryDataMap[normalizedName];
      }
    }

    // Try partial matching with contains
    for (let name of possibleNames) {
      const normalizedName = name.toLowerCase().trim();
      for (let dataKey of Object.keys(countryDataMap)) {
        if (normalizedName.includes(dataKey) || dataKey.includes(normalizedName)) {
          console.log(`✅ PARTIAL MATCH found for "${name}" with "${dataKey}" -> ${countryDataMap[dataKey].value}%`);
          return countryDataMap[dataKey];
        }
      }
    }

    // Special hardcoded cases for reliability
    const firstPossibleName = possibleNames[0]?.toLowerCase() || '';
    
    if (firstPossibleName === 'indonesia' || firstPossibleName.includes('indonesia')) {
      const indonesiaData = countryDataMap['indonesia'];
      if (indonesiaData) {
        console.log(`✅ HARDCODED MATCH found for Indonesia -> ${indonesiaData.value}%`);
        return indonesiaData;
      }
    }
    
    if (firstPossibleName === 'australia' || firstPossibleName.includes('australia')) {
      const australiaData = countryDataMap['australia'];
      if (australiaData) {
        console.log(`✅ HARDCODED MATCH found for Australia -> ${australiaData.value}%`);
        return australiaData;
      }
    }
    
    if (firstPossibleName === 'malaysia' || firstPossibleName.includes('malaysia')) {
      const malaysiaData = countryDataMap['malaysia'];
      if (malaysiaData) {
        console.log(`✅ HARDCODED MATCH found for Malaysia -> ${malaysiaData.value}%`);
        return malaysiaData;
      }
    }
    
    if (firstPossibleName === 'thailand' || firstPossibleName.includes('thailand')) {
      const thailandData = countryDataMap['thailand'];
      if (thailandData) {
        console.log(`✅ HARDCODED MATCH found for Thailand -> ${thailandData.value}%`);
        return thailandData;
      }
    }
    
    if (firstPossibleName === 'japan' || firstPossibleName.includes('japan')) {
      const japanData = countryDataMap['japan'] || countryDataMap['jepang'];
      if (japanData) {
        console.log(`✅ HARDCODED MATCH found for Japan -> ${japanData.value}%`);
        return japanData;
      }
    }

    return null;
  };

  // Get country color with very vibrant colors
  const getCountryColor = (geo) => {
    const countryData = findCountryData(geo);
    
    if (!countryData) {
      return "#E5E7EB"; // Light gray for countries with no data
    }
    
    console.log(`🎨 Coloring country ${geo.properties.NAME} with value ${countryData.value}%`);
    
    // Very vibrant colors for maximum visibility
    if (countryData.value >= 70) {
      return "#22C55E"; // Bright green for high values (Indonesia, Australia)
    } else if (countryData.value >= 50) {
      return "#8B5CF6"; // Bright purple for medium values (Malaysia, Thailand)
    } else if (countryData.value >= 30) {
      return "#374151"; // Dark gray for low values (Japan)
    } else {
      return "#6B7280"; // Medium gray for very low values
    }
  };

  // Get stroke color for countries with data
  const getStrokeColor = (geo) => {
    const countryData = findCountryData(geo);
    return countryData ? "#FFFFFF" : "#9CA3AF";
  };

  // Get stroke width for countries with data
  const getStrokeWidth = (geo) => {
    const countryData = findCountryData(geo);
    return countryData ? 2 : 0.5;
  };

  return (
    <div className={`w-full h-full ${className}`}>
      <div className="relative w-full h-full bg-gray-50 rounded-lg overflow-hidden">
        <ComposableMap
          projectionConfig={{
            scale: 130,
            center: [100, -10],
          }}
          width={800}
          height={400}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Grid lines */}
          <Graticule stroke="#E5E7EB" strokeWidth={0.5} strokeOpacity={0.2} />
          
          {/* World countries */}
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const countryData = findCountryData(geo);
                const fillColor = getCountryColor(geo);
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillColor}
                    stroke={getStrokeColor(geo)}
                    strokeWidth={getStrokeWidth(geo)}
                    style={{
                      default: {
                        outline: "none",
                        fill: fillColor,
                      },
                      hover: {
                        fill: countryData ? "#065F46" : "#9CA3AF",
                        outline: "none",
                        cursor: countryData ? "pointer" : "default",
                      },
                      pressed: {
                        outline: "none",
                        fill: fillColor,
                      },
                    }}
                  >
                    {countryData && (
                      <title>{`${countryData.name}: ${countryData.value}%`}</title>
                    )}
                  </Geography>
                );
              })
            }
          </Geographies>

          {/* Add small markers for countries with data */}
          {data.map((country, index) => {
            const countryMarkers = {
              'indonesia': [113.9213, -0.7893],
              'australia': [133.7751, -25.2744],
              'malaysia': [101.9758, 4.2105],
              'thailand': [100.9925, 15.8700],
              'japan': [138.2529, 36.2048],
              'jepang': [138.2529, 36.2048],
            };

            const coordinates = countryMarkers[country.name.toLowerCase()];
            if (!coordinates) return null;

            return (
              <Marker key={index} coordinates={coordinates}>
                <circle
                  r={4}
                  fill="#FFFFFF"
                  stroke="#1F2937"
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                >
                  <title>{`${country.name}: ${country.value}%`}</title>
                </circle>
                <text
                  textAnchor="middle"
                  y={-10}
                  style={{
                    fontFamily: "system-ui",
                    fontSize: "10px",
                    fontWeight: "700",
                    fill: "#1F2937",
                    textShadow: "0 0 2px white",
                  }}
                >
                  {country.value}%
                </text>
              </Marker>
            );
          })}
        </ComposableMap>
      </div>
      
      {/* Professional Legend */}
      <div className="flex items-center justify-center mt-4 space-x-6 text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#22C55E" }}></div>
          <span className="text-gray-700 font-medium">High (70%+)</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#8B5CF6" }}></div>
          <span className="text-gray-700 font-medium">Medium (50-70%)</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#374151" }}></div>
          <span className="text-gray-700 font-medium">Low (30-50%)</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#E5E7EB" }}></div>
          <span className="text-gray-700 font-medium">No Data</span>
        </div>
      </div>

      {/* Data summary */}
      {data.length > 0 && (
        <div className="mt-4 text-center">
          <div className="text-sm text-gray-600 font-medium">
            Showing data for {data.length} countries
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldMap;
