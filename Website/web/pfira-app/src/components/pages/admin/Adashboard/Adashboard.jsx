import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';

const Adashboard = () => {
  const GOOGLE_MAPS_API_KEY = 'AIzaSyBX5taF1AgNhicxw5_BXUJDs6ouniAuiQI';
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [fireReports, setFireReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [showAdminInfo, setShowAdminInfo] = useState(false);
  const [showLegend, setShowLegend] = useState(true); // New state for legend toggle
  const [showDashboard, setShowDashboard] = useState(true); // Toggle for entire dashboard panel
  const [isAutoSelecting, setIsAutoSelecting] = useState(false); // State for auto-selection indicator
  const [mapLoadTimeout, setMapLoadTimeout] = useState(false); // State for map load timeout
  const [retryCount, setRetryCount] = useState(0); // State for retry count
  const [pendingSelection, setPendingSelection] = useState(null); // State for pending report selection

  // Fixed location for Bureau of Fire Protection - Regional Office VII
  // 7VXR+5VG, 6000 Natalio B. Bacalso Ave, Cebu City, 6000 Cebu
  const adminLocation = {
    lat: 10.3157,
    lng: 123.8854
  };

  const [mapCenter, setMapCenter] = useState(adminLocation); // State for map center

  // Color mapping based on Philippines Bureau of Fire Protection alarm levels
  const getAlarmLevelColor = (alarmLevel) => {
    if (!alarmLevel) return '#6b7280'; // Gray for unknown
    
    const level = alarmLevel.toLowerCase();
    
    // Fire alarm levels with appropriate colors
    if (level.includes('first alarm')) return '#fef3c7'; // Light yellow
    if (level.includes('second alarm')) return '#fed7aa'; // Light orange
    if (level.includes('third alarm')) return '#fecaca'; // Light red
    if (level.includes('fourth alarm')) return '#f87171'; // Medium red
    if (level.includes('fifth alarm')) return '#ef4444'; // Red
    if (level.includes('task force alpha')) return '#dc2626'; // Dark red
    if (level.includes('task force bravo')) return '#b91c1c'; // Darker red
    if (level.includes('task force charlie')) return '#991b1b'; // Very dark red
    if (level.includes('task force delta')) return '#7f1d1d'; // Deepest red
    if (level.includes('general alarm')) return '#450a0a'; // Darkest red
    
    // Special cases
    if (level.includes('fire out')) return '#93c5fd'; // Light blue
    if (level.includes('under control')) return '#fbbf24'; // Amber
    if (level.includes('false alarm')) return '#9ca3af'; // Gray
    
    return '#6b7280'; // Default gray
  };

  // Get marker color - prioritize alarm level over prediction
  const getMarkerColor = (report) => {
    // First check for alarm level
    if (report.recommended_alarm_level || report.alarm_level) {
      return getAlarmLevelColor(report.recommended_alarm_level || report.alarm_level);
    }
    
    // Fallback to prediction-based colors
    switch (report.prediction) {
      case 'Fire': return '#ef4444'; // Red for active fire
      case 'No Fire': return '#93c5fd'; // Light blue for no fire
      default: return '#6b7280'; // Gray for unknown
    }
  };

  // Get text color that contrasts well with background
  const getAlarmLevelTextColor = (alarmLevel) => {
    if (!alarmLevel) return '#374151';
    
    const level = alarmLevel.toLowerCase();
    
    // Light backgrounds need dark text
    if (level.includes('first alarm') || level.includes('second alarm') || level.includes('fire out')) {
      return '#374151';
    }
    
    // Medium backgrounds can use dark text
    if (level.includes('third alarm') || level.includes('under control')) {
      return '#1f2937';
    }
    
    // Dark backgrounds need light text
    return '#ffffff';
  };

  // Fetch fire reports from the API
  const fetchFireReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const response = await fetch('https://fire-detection-api-production-f543.up.railway.app/get_reports');
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Fetched fire reports for admin dashboard:', data.length);
        
        // Filter reports that have valid coordinates AND are not cancelled or fire out
        const reportsWithCoords = data.filter(report => {
          const hasCoords = report.latitude && report.longitude && !isNaN(report.latitude) && !isNaN(report.longitude);
          const statusText = (report.status || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          return hasCoords && !isCancelled && !isFireOut;
        });
        
        console.log('🔥 Reports with valid coordinates:', reportsWithCoords.length);
        
        // Log each report's location for debugging
        reportsWithCoords.forEach(report => {
          console.log(`Admin Dashboard Report ${report.id}: ${report.latitude}, ${report.longitude} - ${report.address || report.geotag_location}`);
        });
        
        setFireReports(reportsWithCoords);
        
        // Check if there's a selected report ID from navigation
        const selectedReportId = localStorage.getItem('selectedReportId');
        if (selectedReportId) {
          const reportToSelect = reportsWithCoords.find(report => report.id === selectedReportId);
          if (reportToSelect) {
            console.log('Auto-selecting report from navigation:', reportToSelect.id);
            setSelectedReport(reportToSelect);
            setPendingSelection(reportToSelect);
            // Center map on the selected fire report
            setMapCenter({
              lat: parseFloat(reportToSelect.latitude),
              lng: parseFloat(reportToSelect.longitude)
            });
            // Don't clear the ID yet - wait for map to load
          }
        }
      } else {
        console.error('❌ Failed to fetch fire reports:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching fire reports:', error);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  // Load fire reports when component mounts
  useEffect(() => {
    fetchFireReports();
    
    // Check for pending selection immediately on mount
    const selectedReportId = localStorage.getItem('selectedReportId');
    if (selectedReportId) {
      console.log('Found pending selection on mount:', selectedReportId);
      // Set a flag that we have a pending selection
      setPendingSelection({ id: selectedReportId });
    }
    
    // Set up periodic refresh to get new reports
    const refreshInterval = setInterval(() => {
      console.log('🔄 Refreshing fire reports...');
      fetchFireReports();
    }, 30000); // Refresh every 30 seconds
    
    // Set up map load timeout
    const mapTimeout = setTimeout(() => {
      if (!mapLoaded) {
        console.warn('⚠️ Map load timeout - enabling manual refresh');
        setMapLoadTimeout(true);
      }
    }, 10000); // 10 second timeout
    
    return () => {
      clearInterval(refreshInterval);
      clearTimeout(mapTimeout);
    };
  }, [fetchFireReports, mapLoaded]);

  // Handle auto-selection when both map and reports are loaded
  useEffect(() => {
    if (mapLoaded && fireReports.length > 0) {
      const selectedReportId = localStorage.getItem('selectedReportId');
      if (selectedReportId) {
        const reportToSelect = fireReports.find(report => report.id === selectedReportId);
        if (reportToSelect) {
          console.log('Both map and reports loaded - auto-selecting report:', reportToSelect.id);
          setIsAutoSelecting(true);
          setSelectedReport(reportToSelect);
          setPendingSelection(null); // Clear pending selection
          // Center map on the selected fire report
          setMapCenter({
            lat: parseFloat(reportToSelect.latitude),
            lng: parseFloat(reportToSelect.longitude)
          });
          localStorage.removeItem('selectedReportId');
          setTimeout(() => setIsAutoSelecting(false), 2000);
        }
      } else if (pendingSelection) {
        // If we have a pending selection but no localStorage ID, use the pending selection
        console.log('Using pending selection:', pendingSelection.id);
        setIsAutoSelecting(true);
        setSelectedReport(pendingSelection);
        // Center map on the selected fire report
        setMapCenter({
          lat: parseFloat(pendingSelection.latitude),
          lng: parseFloat(pendingSelection.longitude)
        });
        setPendingSelection(null);
        setTimeout(() => setIsAutoSelecting(false), 2000);
      }
    }
  }, [mapLoaded, fireReports, pendingSelection]);

  // Fallback: Handle selection even if map is slow to load
  useEffect(() => {
    if (fireReports.length > 0 && pendingSelection && !mapLoaded) {
      // If we have reports and a pending selection but map is still loading,
      // wait a bit then try to select anyway
      const fallbackTimeout = setTimeout(() => {
        if (pendingSelection && !mapLoaded) {
          console.log('Fallback selection - map still loading, selecting report anyway:', pendingSelection.id);
          setIsAutoSelecting(true);
          setSelectedReport(pendingSelection);
          setPendingSelection(null);
          setTimeout(() => setIsAutoSelecting(false), 2000);
        }
      }, 5000); // Wait 5 seconds for map to load, then fallback

      return () => clearTimeout(fallbackTimeout);
    }
  }, [fireReports, pendingSelection, mapLoaded]);

  const mapContainerStyle = {
    width: '100vw',
    height: '100vh'
  };

  const onLoad = useCallback((map) => {
    console.log('✅ Map loaded successfully');
    setMapLoaded(true);
    setMapError(null);
  }, []);

  // Handle LoadScript load
  const handleLoadScriptLoad = useCallback(() => {
    console.log('✅ Google Maps API loaded successfully');
  }, []);

  // Handle LoadScript error
  const handleLoadScriptError = useCallback((error) => {
    console.error('❌ Google Maps API error:', error);
    setMapError('Failed to load Google Maps API. Please check your internet connection and refresh the page.');
    setMapLoaded(false);
  }, []);

  const onError = useCallback((error) => {
    console.error('❌ Map error:', error);
    setMapError('Failed to load map. Please refresh the page.');
    setMapLoaded(false);
  }, []);

  const onUnmount = useCallback(() => {
    console.log('🗺️ Map unmounted');
    setMapLoaded(false);
  }, []);

  // Manual refresh function
  const handleManualRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered, retry count:', retryCount);
    setMapLoaded(false);
    setMapError(null);
    setMapLoadTimeout(false);
    setRetryCount(prev => prev + 1);
    
    // Force complete re-render of the map component
    setTimeout(() => {
      setShowDashboard(prev => !prev);
      setTimeout(() => setShowDashboard(prev => !prev), 100);
    }, 100);
  }, [retryCount]);

  // Handle marker click to center map and select report
  const handleMarkerClick = useCallback((report) => {
    console.log('Marker clicked:', report.id);
    setSelectedReport(report);
    // Center map on the clicked fire report
    setMapCenter({
      lat: parseFloat(report.latitude),
      lng: parseFloat(report.longitude)
    });
  }, []);

  return (
    <div className="relative">
      <LoadScript 
        key={`maps-${retryCount}-${mapLoadTimeout ? Date.now() : 'initial'}`}
        googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        onLoad={handleLoadScriptLoad}
        onError={handleLoadScriptError}
        loadingElement={
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading Google Maps API...</p>
            </div>
          </div>
        }
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={15}
          onLoad={onLoad}
          onError={onError}
          onUnmount={onUnmount}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
          }}
        >
          {/* Admin Station Marker - Bureau of Fire Protection Regional Office VII */}
          {mapLoaded && (
            <Marker
              position={adminLocation}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#1E40AF',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 3,
                scale: 25,
              }}
              label={{
                text: '🏢',
                fontSize: '20px'
              }}
              title="🏢 Click to view BFP Regional Office VII details (Your Location)"
              zIndex={2000}
              onClick={() => setShowAdminInfo(true)}
              cursor="pointer"
            />
          )}

          {/* Admin Station Info Window */}
          {showAdminInfo && (
            <InfoWindow
              position={adminLocation}
              onCloseClick={() => setShowAdminInfo(false)}
            >
              <div className="p-3 max-w-sm">
                <h3 className="font-bold text-lg mb-2 text-blue-600">🏢 BFP Regional Office VII</h3>
                <p className="text-sm text-blue-600 font-medium mb-2">📍 Your Current Location</p>
                <div className="space-y-1 text-sm text-gray-700">
                  <p><strong>Address:</strong> 6000 Natalio B. Bacalso Ave</p>
                  <p><strong>City:</strong> Cebu City, Cebu 6000</p>
                  <p><strong>Plus Code:</strong> 7VXR+5VG</p>
                  <p><strong>Coordinates:</strong></p>
                  <p className="ml-2">Lat: {adminLocation.lat}</p>
                  <p className="ml-2">Lng: {adminLocation.lng}</p>
                  <p><strong>Status:</strong> <span className="text-green-600 font-semibold">Active</span></p>
                </div>
              </div>
            </InfoWindow>
          )}

          {/* Fire Report Markers */}
          {mapLoaded && fireReports.map((report) => {
            console.log(`Rendering fire report marker for ${report.id} at:`, report.latitude, report.longitude);
            return (
              <Marker
                key={`${report.id}-${report.latitude}-${report.longitude}-${report.address || report.geotag_location || 'no-address'}`}
                position={{
                  lat: parseFloat(report.latitude),
                  lng: parseFloat(report.longitude)
                }}
                onClick={() => handleMarkerClick(report)}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: getMarkerColor(report),
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 3,
                  scale: 20,
                }}
                label={{
                  text: '🔥',
                  fontSize: '16px'
                }}
                zIndex={1000}
              />
            );
          })}

          {/* Info Window for Selected Report */}
          {selectedReport && (
            <InfoWindow
              position={{
                lat: parseFloat(selectedReport.latitude),
                lng: parseFloat(selectedReport.longitude)
              }}
              onCloseClick={() => setSelectedReport(null)}
            >
              <div className="p-3 max-w-sm">
                <h3 className="font-bold text-lg mb-2 text-red-600">🔥 Fire Report</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Reporter:</strong> {selectedReport.reporter}</p>
                  <p><strong>Cause:</strong> {selectedReport.cause_of_fire || 'Not specified'}</p>
                  {(selectedReport.recommended_alarm_level || selectedReport.alarm_level) && (
                    <p><strong>Alarm Level:</strong> 
                      <span 
                        className="ml-1 px-2 py-1 rounded text-xs font-semibold"
                        style={{ 
                          backgroundColor: getMarkerColor(selectedReport),
                          color: getAlarmLevelTextColor(selectedReport.recommended_alarm_level || selectedReport.alarm_level)
                        }}
                      >
                        {selectedReport.recommended_alarm_level || selectedReport.alarm_level}
                      </span>
                    </p>
                  )}
                  <p><strong>AI Fire Detection:</strong> 
                    <span className={`ml-1 px-2 py-1 rounded text-xs font-semibold ${
                      selectedReport.prediction === 'Fire' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {selectedReport.prediction}{selectedReport.confidence ? ` (${selectedReport.confidence})` : ''}
                    </span>
                  </p>
                  {(selectedReport.smoke_intensity || selectedReport.smoke_confidence) && (
                    <p><strong>Smoke Analysis:</strong> {selectedReport.smoke_intensity || ''} {selectedReport.smoke_confidence || ''}</p>
                  )}
                  {selectedReport.structure && (
                    <p><strong>Structure:</strong> {selectedReport.structure}</p>
                  )}
                  {selectedReport.number_of_structures_on_fire && (
                    <p><strong>Structures Affected:</strong> {selectedReport.number_of_structures_on_fire} structure(s)</p>
                  )}
                  <p><strong>Location:</strong> {selectedReport.address || selectedReport.geotag_location}</p>
                  <p><strong>Reported:</strong> {selectedReport.formatted_timestamp}</p>
                  {selectedReport.image_url && (
                    <div className="mt-2">
                      <img 
                        src={selectedReport.image_url} 
                        alt="Fire report" 
                        className="w-full h-32 object-cover rounded"
                      />
                    </div>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>
      
      {/* Loading Overlay */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600 mb-4">Loading map...</p>
            {mapLoadTimeout && (
              <div>
                <p className="text-gray-500 text-sm mb-3">Map is taking longer than expected to load.</p>
                <button
                  onClick={handleManualRefresh}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh Map</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auto-selection Indicator */}
      {isAutoSelecting && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span className="font-medium">Locating selected report...</span>
        </div>
      )}

      {/* Pending Selection Indicator */}
      {pendingSelection && !mapLoaded && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <div className="animate-pulse rounded-full h-4 w-4 bg-white"></div>
          <span className="font-medium">Report selected, waiting for map to load...</span>
        </div>
      )}

      {/* Error Overlay */}
      {mapError && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">🗺️</div>
            <p className="text-red-600 font-semibold mb-2">Map Error</p>
            <p className="text-gray-600 mb-4">{mapError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}
      
      {/* Toggle Button for Dashboard Panel */}
      <div className="absolute top-4 left-4 z-30">
        <button
          onClick={() => setShowDashboard(!showDashboard)}
          className="bg-white hover:bg-gray-50 rounded-lg shadow-lg border border-gray-200 p-3 transition-all duration-200 group"
          title={showDashboard ? "Hide Dashboard" : "Show Dashboard"}
        >
          <svg 
            className={`w-5 h-5 text-red-600 transition-transform duration-200 ${showDashboard ? 'rotate-180' : ''}`} 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Professional Admin Dashboard Panel - Compact & Toggleable */}
      {showDashboard && (
        <div className="absolute top-4 left-16 bg-white backdrop-blur-sm bg-opacity-98 rounded-lg shadow-xl border border-gray-100 z-20 w-64">
          {/* Compact Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 p-3 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm tracking-wide">Admin Dashboard</h3>
                <p className="text-red-100 text-xs">Fire Emergency</p>
              </div>
              <button 
                onClick={() => setShowDashboard(false)}
                className="text-white hover:text-red-200 transition-colors"
                title="Close Dashboard"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {/* Active Reports Section - Compact */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="bg-red-100 p-1.5 rounded-md">
                    <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Active Reports</p>
                    <p className="text-xs text-gray-500">Real-time incidents</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-red-600">{fireReports.length}</div>
                  <div className="text-xs text-gray-500">incidents</div>
                </div>
              </div>
            
            {reportsLoading && (
              <div className="flex items-center justify-center space-x-2 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                <span className="text-gray-600 text-sm">Updating reports...</span>
              </div>
            )}
            
              <button 
                onClick={fetchFireReports}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                disabled={reportsLoading}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                <span>Refresh</span>
              </button>
          </div>
          
            {/* Fire Alarm Levels Legend - Compact & Toggleable */}
            <div className="bg-gray-50 rounded-lg">
              {/* Legend Header with Toggle Button */}
              <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setShowLegend(!showLegend)}>
                <div className="flex items-center space-x-2">
                  <div className="bg-orange-100 p-1.5 rounded-md">
                    <svg className="w-3 h-3 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Fire Alarm Levels</p>
                    <p className="text-xs text-gray-500">Severity indicators</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <svg 
                    className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showLegend ? 'transform rotate-180' : ''}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            
              {/* Legend Content - Collapsible & Compact */}
              {showLegend && (
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#93c5fd' }}></div>
                      <span className="text-gray-700 font-medium">Fire Out</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#fef3c7' }}></div>
                      <span className="text-gray-700 font-medium">First Alarm</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#fed7aa' }}></div>
                      <span className="text-gray-700 font-medium">Second Alarm</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#fecaca' }}></div>
                      <span className="text-gray-700 font-medium">Third Alarm</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#ef4444' }}></div>
                      <span className="text-gray-700 font-medium">Fifth+ Alarm</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#450a0a' }}></div>
                      <span className="text-gray-700 font-medium">General Alarm</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Adashboard;