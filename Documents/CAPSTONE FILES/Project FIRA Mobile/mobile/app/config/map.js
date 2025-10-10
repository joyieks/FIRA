// Google Maps API Configuration
export const GOOGLE_MAPS_API_KEY = 'AIzaSyDv-FC2CTEpLuVAlXCHMtu4XqAEPNtOjos';

// Map configuration constants
export const MAP_CONFIG = {
  // Default map region settings
  DEFAULT_LATITUDE_DELTA: 0.01,
  DEFAULT_LONGITUDE_DELTA: 0.01,
  
  // Route calculation settings
  ROUTE_STROKE_COLOR: '#3b82f6',
  ROUTE_STROKE_WIDTH: 6,
  ROUTE_LINE_DASH_PATTERN: [5, 5],
  
  // Marker sizes
  MARKER_SIZE: {
    SMALL: 35,
    MEDIUM: 40,
    LARGE: 50,
  },
  
  // Station jurisdiction circle
  JURISDICTION_RADIUS: 2000, // 2km in meters
  JURISDICTION_STROKE_COLOR: '#8b5cf6',
  JURISDICTION_FILL_COLOR: 'rgba(139, 92, 246, 0.1)',
  JURISDICTION_STROKE_WIDTH: 2,
};

// Directions API endpoints
export const DIRECTIONS_API = {
  BASE_URL: 'https://maps.googleapis.com/maps/api/directions/json',
  TRAVEL_MODE: 'driving', // driving, walking, bicycling, transit
  AVOID: 'tolls', // tolls, highways, ferries, indoor
};
