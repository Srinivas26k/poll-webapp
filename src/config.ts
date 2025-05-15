// This file provides configuration for the application
// including API URLs and feature flags

// Get the API URL based on environment
function getApiUrl() {
  // For browser debugging, check if there's a debug override
  if (typeof window !== 'undefined' && window.localStorage.getItem('debug_api_url')) {
    return window.localStorage.getItem('debug_api_url');
  }

  // Default for local development
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
  }
  
  // For production deployment on Vercel
  if (typeof window !== 'undefined') {
    // In production, use the same origin for API calls
    // This works because we're configuring Vercel to route /api/* to our server
    return window.location.origin;
  }
  
  // Fallback for production
  return process.env.REACT_APP_SERVER_URL || '';
}

// Make sure we have a valid API_URL
const apiUrl = getApiUrl();
export const API_URL = apiUrl || (typeof window !== 'undefined' ? window.location.origin : '');

// Log the API URL to help debug
console.log('API URL configured as:', API_URL);
console.log('Environment: ', {
  nodeEnv: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production',
  windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'N/A'
});

// Feature flags
export const FEATURES = {
  transcription: true,
  quizGeneration: true,
  participantTracking: true
};
