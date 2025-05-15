// This file provides configuration for the application
// including API URLs and feature flags

// Get the API URL based on environment
function getApiUrl() {
  // Default for local development
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
  }
  
  // For Vercel production deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback for production
  return process.env.REACT_APP_SERVER_URL || '';
}

export const API_URL = getApiUrl();

// Feature flags
export const FEATURES = {
  transcription: true,
  quizGeneration: true,
  participantTracking: true
};
