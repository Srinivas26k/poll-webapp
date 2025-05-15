#!/bin/bash
# This script runs during Vercel build to set proper environment configurations

echo "Running Vercel build configuration script..."

# Check if VERCEL_URL is available
if [ -n "$VERCEL_URL" ]; then
  echo "Detected Vercel deployment URL: $VERCEL_URL"
  
  # Create a REACT_APP_VERCEL_URL environment variable that can be accessed by the frontend
  echo "REACT_APP_VERCEL_URL=https://$VERCEL_URL" >> .env.production
  
  echo "Added REACT_APP_VERCEL_URL to environment"
else
  echo "Warning: VERCEL_URL not available during build. This is normal for preview builds."
fi

# Output debug info about environment
echo "NODE_ENV: $NODE_ENV"
echo "Environment variables configured for build"

# Continue with the normal build process
echo "Starting React build..."
npm run build
echo "Build completed"
