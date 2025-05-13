export interface Session {
  id: string;
  hostId: string;
  participants: string[];
  transcripts: string[];
  polls: Poll[];
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  responses: PollResponse[];
}

export interface PollResponse {
  userId: string;
  answer: string;
}

export interface TranscriptChunk {
  text: string;
  timestamp: number;
}

export interface Quiz {
  id: string;
  question: string;
  options: string[];
  correctAnswer?: string;
}
