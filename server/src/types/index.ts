// Types for user details and session management
export interface UserDetails {
  name: string;
  email: string;
  userId?: string;
}

export interface Session {
  id: string;
  name: string;
  host: UserDetails;
  hostId?: string;
  participants: UserDetails[];
  createdAt: number;
  status?: 'active' | 'ended';
  transcripts?: string[];
  polls?: Poll[];
}

export interface Quiz {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  timeLimit?: number;
  timestamp?: number;
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

export interface SessionCreationParams {
  name: string;
  host: UserDetails;
}

export interface SessionJoinParams {
  sessionId: string;
  participant: UserDetails;
} 