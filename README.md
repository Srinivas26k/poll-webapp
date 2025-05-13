# Contents of /live-transcription-quiz/live-transcription-quiz/README.md

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

## Usage

1. Start the server:
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