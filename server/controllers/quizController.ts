import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface Quiz {
  id: string;
  question: string;
  options: string[];
  responses: { userId: string; answer: string }[];
  correctAnswer?: string;
}

const quizzes = new Map<string, Quiz>();

export const createQuiz = (req: Request, res: Response) => {
  const { question, options, correctAnswer } = req.body;
  const quizId = uuidv4();

  const quiz: Quiz = {
    id: quizId,
    question,
    options,
    responses: [],
    correctAnswer
  };

  quizzes.set(quizId, quiz);
  res.json({ quizId, quiz });
};

export const submitAnswer = (req: Request, res: Response) => {
  const { quizId, userId, answer } = req.body;
  const quiz = quizzes.get(quizId);

  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }

  quiz.responses.push({ userId, answer });
  res.json({ success: true });
};

export const getQuizResults = (req: Request, res: Response) => {
  const { quizId } = req.params;
  const quiz = quizzes.get(quizId);

  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }

  const results = {
    question: quiz.question,
    totalResponses: quiz.responses.length,
    optionCounts: quiz.options.reduce((acc: { [key: string]: number }, option) => {
      acc[option] = quiz.responses.filter(r => r.answer === option).length;
      return acc;
    }, {}),
    correctAnswer: quiz.correctAnswer
  };

  res.json(results);
};
