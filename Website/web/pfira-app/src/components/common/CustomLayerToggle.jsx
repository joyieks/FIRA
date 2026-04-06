import React, { useState } from 'react';

// Memoized CustomLayerToggle Component - Premium modern UI with sub-layer controls
const CustomLayerToggle = React.memo(({ 
  mapTypeId, 
  onMapTypeChange, 
  mapInstance, 
  showTerrainLayer, 
  onTerrainChange, 
  showLabelsLayer, 
  onLabelsChange 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || !mapInstance) return null;

  const toggleMapType = () => {
    const newType = mapTypeId === 'roadmap' ? 'satellite' : 'roadmap';
    onMapTypeChange(newType);
  };

  const isRoadmapMode = mapTypeId === 'roadmap';
  const isSatelliteMode = mapTypeId === 'satellite';

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 10,
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        border: '1px solid #e5e7eb',
      }}
    >
      {/* Header Section - Map/Satellite Toggle Buttons */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: '0px' }}>
        {/* Map Button */}
        <button
          onClick={toggleMapType}
          style={{
            backgroundColor: isRoadmapMode ? '#f0f9ff' : 'white',
            color: '#1f2937',
            border: 'none',
            borderRight: '1px solid #e5e7eb',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            letterSpacing: '0.4px',
            transition: 'all 0.2s ease',
            textAlign: 'center',
            flex: 1,
          }}
          onMouseEnter={(e) => {
            if (!isRoadmapMode) {
              e.target.style.backgroundColor = '#f9fafb';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = isRoadmapMode ? '#f0f9ff' : 'white';
          }}
          title="Switch to Map view"
        >
          Map
        </button>

        {/* Satellite Button */}
        <button
          onClick={toggleMapType}
          style={{
            backgroundColor: isSatelliteMode ? '#f0f9ff' : 'white',
            color: '#1f2937',
            border: 'none',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            letterSpacing: '0.4px',
            transition: 'all 0.2s ease',
            textAlign: 'center',
            flex: 1,
          }}
          onMouseEnter={(e) => {
            if (!isSatelliteMode) {
              e.target.style.backgroundColor = '#f9fafb';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = isSatelliteMode ? '#f0f9ff' : 'white';
          }}
          title="Switch to Satellite view"
        >
          Satellite
        </button>

        {/* Sub-layer Controls - Terrain (for Roadmap mode) */}
        {isRoadmapMode && (
          <div
            style={{
              backgroundColor: '#fafbfc',
              borderTop: '1px solid #e5e7eb',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              gridColumn: '1 / -1',
            }}
          >
            <input
              type="checkbox"
              id="terrain-checkbox"
              checked={showTerrainLayer}
              onChange={(e) => onTerrainChange(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: '#ef4444',
              }}
              title="Toggle terrain layer"
            />
            <label
              htmlFor="terrain-checkbox"
              style={{
                fontSize: '12px',
                fontWeight: '500',
                color: '#374151',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Terrain
            </label>
          </div>
        )}

        {/* Sub-layer Controls - Labels (for Satellite mode) */}
        {isSatelliteMode && (
          <div
            style={{
              backgroundColor: '#fafbfc',
              borderTop: '1px solid #e5e7eb',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              gridColumn: '1 / -1',
            }}
          >
            <input
              type="checkbox"
              id="labels-checkbox"
              checked={showLabelsLayer}
              onChange={(e) => onLabelsChange(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: '#ef4444',
              }}
              title="Toggle labels layer"
            />
            <label
              htmlFor="labels-checkbox"
              style={{
                fontSize: '12px',
                fontWeight: '500',
                color: '#374151',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Labels
            </label>
          </div>
        )}
      </div>
    </div>
  );
});

CustomLayerToggle.displayName = 'CustomLayerToggle';

export default CustomLayerToggle;
