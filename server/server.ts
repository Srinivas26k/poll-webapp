import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSessionRoutes } from './routes';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Set up routes
setupSessionRoutes(app);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-session', (sessionId: string) => {
    socket.join(sessionId);
    console.log(`User ${socket.id} joined session ${sessionId}`);
  });

  socket.on('transcription', ({ sessionId, text }) => {
    socket.to(sessionId).emit('transcription-update', text);
  });

  socket.on('new-poll', ({ sessionId, poll }) => {
    socket.to(sessionId).emit('poll-received', poll);
  });

  socket.on('poll-answer', ({ sessionId, answer, userId }) => {
    io.to(sessionId).emit('poll-response', { answer, userId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
