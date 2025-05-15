# Live Transcription Quiz

This project is a live transcription quiz application that allows a host to create a session where participants can join and interact in real-time. The host can start a microphone session, and the audio is transcribed and sent to participants as a running commentary. Every 5 minutes, a poll or quiz is generated from the transcription, allowing participants to answer questions based on the content.

## Features

- Real-time audio transcription using the Web Speech API.
- Poll and quiz generation based on transcriptions.
- Live audio display for participants.
- Session management for hosts.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd live-transcription-quiz
   ```

3. Install the dependencies:
   ```
   npm install
   ```

## Configuration

Create a `.env` file in the root directory with the following environment variables:

```
# Pusher Configuration
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_pusher_cluster

# API Keys
REACT_APP_OPENROUTER_API_KEY=your_openrouter_api_key

# Frontend Configuration (match these values to the ones above)
REACT_APP_PUSHER_KEY=your_pusher_key
REACT_APP_PUSHER_CLUSTER=your_pusher_cluster

# Development Environment
REACT_APP_SERVER_URL=http://localhost:5000
NODE_ENV=development
PORT=5000
```

## Vercel Deployment

This application is configured for deployment on Vercel. Follow these steps:

1. Create a Vercel account and install the Vercel CLI:
   ```
   npm install -g vercel
   ```

2. Login to Vercel:
   ```
   vercel login
   ```

3. Configure the environment variables in Vercel:
   - Go to the Vercel dashboard > Project > Settings > Environment Variables
   - Add all the variables from your `.env` file
   - Make sure to set `NODE_ENV` to `production`

4. Deploy the application:
   ```
   vercel --prod
   ```

5. After deployment, update the `REACT_APP_SERVER_URL` environment variable to match your Vercel deployment URL.

## Usage

1. For local development, start the server:
   ```
   npm run server
   ```

2. Start the client application:
   ```
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000` to access the application.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or features.

## License

This project is licensed under the MIT License.