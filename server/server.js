require('dotenv').config();

const express = require('express');
const Pusher = require('pusher');
const cors = require('cors');
const router = express.Router();

const app = express();

// Verify environment variables
const requiredEnvVars = ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
  encryptionMasterKeyBase64: process.env.PUSHER_ENCRYPTION_KEY
});

app.use(cors());
app.use(express.json());

// Store active sessions and their data
const sessions = new Map();
const transcripts = new Map();
const activeQuizzes = new Map();
const participants = new Map(); // Store participant names

// Basic routes
router.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

router.get('/sessions', (req, res) => {
  const activeSessions = Array.from(sessions.keys());
  res.json({ sessions: activeSessions });
});

app.use('/api', router);

// Create session endpoint
router.post('/session/create', (req, res) => {
  const { sessionId } = req.body;
  console.log('Creating new session:', sessionId);
  
  try {
    sessions.set(sessionId, new Set());
    transcripts.set(sessionId, []);
    activeQuizzes.set(sessionId, new Map());
    
    pusher.trigger(`session-${sessionId}`, 'session-created', {
      message: 'Session created successfully'
    }).then(() => {
      console.log('Successfully sent session creation via Pusher');
      res.json({ success: true, sessionId });
    }).catch((error) => {
      console.error('Error sending session creation via Pusher:', error);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    });
  } catch (error) {
    console.error('Error in session creation:', error);
    res.status(500).json({ success: false, error: 'Failed to create session' });
  }
});

// Join session endpoint
router.post('/session/join', (req, res) => {
  const { sessionId, userId, name } = req.body;
  const session = sessions.get(sessionId);
  if (session) {
    session.add(userId);
    // Store participant name
    if (!participants.has(sessionId)) {
      participants.set(sessionId, new Map());
    }
    participants.get(sessionId).set(userId, name || 'Anonymous');
    
    pusher.trigger(`session-${sessionId}`, 'user-joined', {
      userId,
      name: name || 'Anonymous',
      message: 'User joined session'
    });
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'Session not found' });
  }
});

// New transcription endpoint
app.post('/api/transcription', async (req, res) => {
  const { sessionId, text } = req.body;
  if (!sessionId || !text) {
    return res.status(400).json({ error: 'Missing sessionId or text' });
  }

  try {
    // Split text into chunks if it's too large
    const maxChunkSize = 8000; // Pusher's limit is 10240, using 8000 to be safe
    const chunks = [];
    let currentChunk = '';
    
    // Split by sentences to maintain readability
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          // If a single sentence is too long, split it by words
          const words = sentence.split(' ');
          for (const word of words) {
            if ((currentChunk + word + ' ').length > maxChunkSize) {
              chunks.push(currentChunk);
              currentChunk = word + ' ';
            } else {
              currentChunk += word + ' ';
            }
          }
        }
      } else {
        currentChunk += sentence + ' ';
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // Send each chunk with appropriate metadata
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await pusher.trigger(`session-${sessionId}`, 'new-transcription', {
        text: chunk,
        isPartial: i < chunks.length - 1,
        timestamp: Date.now(),
        chunkIndex: i,
        totalChunks: chunks.length
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error in transcription endpoint:', error);
    res.status(500).json({ error: 'Failed to process transcription' });
  }
});

// New quiz endpoint
router.post('/quiz', async (req, res) => {
  const { sessionId, quiz, timeLimit = 60 } = req.body; // Default 60 seconds time limit
  console.log('Received quiz for session', sessionId, ':', quiz);

  if (!sessions.get(sessionId)) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const quizId = Date.now();
  const quizData = {
    ...quiz,
    id: quizId,
    timestamp: Date.now(),
    timeLimit,
    answers: new Map()
  };

  // Store the active quiz
  activeQuizzes.get(sessionId).set(quizId, quizData);

  // Set a timeout to end the quiz
  setTimeout(() => {
    const quiz = activeQuizzes.get(sessionId)?.get(quizId);
    if (quiz) {
      // Send quiz results with participant names
      const answersWithNames = Array.from(quiz.answers.entries()).map(([userId, answer]) => ({
        userId,
        name: participants.get(sessionId)?.get(userId) || 'Anonymous',
        answer
      }));

      pusher.trigger(`session-${sessionId}`, 'quiz-ended', {
        quizId,
        answers: answersWithNames
      });
      // Remove the quiz from active quizzes
      activeQuizzes.get(sessionId).delete(quizId);
    }
  }, timeLimit * 1000);

  try {
    await pusher.trigger(`session-${sessionId}`, 'new-quiz', {
      quiz: quizData
    });
    console.log('Successfully sent quiz via Pusher');
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending quiz:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit answer endpoint
router.post('/quiz/answer', (req, res) => {
  const { sessionId, userId, name, answer, questionId } = req.body;
  const session = sessions.get(sessionId);
  const quiz = activeQuizzes.get(sessionId)?.get(questionId);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  if (!quiz) {
    return res.status(400).json({ success: false, error: 'Quiz is no longer active' });
  }

  // Store the answer
  quiz.answers.set(userId, answer);

  // Broadcast the answer submission with participant name
  pusher.trigger(`session-${sessionId}`, 'answer-submitted', {
    userId,
    name: name || 'Anonymous',
    answer,
    questionId,
    timestamp: Date.now()
  });

  res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
