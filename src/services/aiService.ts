// Check if API key is available
const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
if (!apiKey) {
  console.warn('OpenRouter API key is missing. Quiz generation will use fallback questions.');
}

import { Quiz } from '../types';

const OPENROUTER_API_KEY = process.env.REACT_APP_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const generateQuizFromTranscript = async (transcript: string): Promise<Quiz> => {
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Live Transcription Quiz'
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a quiz generator. Generate a multiple-choice question based on the given transcript. The question should be clear, concise, and test understanding of the key points. Include 4 options, with one correct answer and three plausible distractors. Also provide a brief explanation of why the correct answer is right.'
          },
          {
            role: 'user',
            content: `Generate a quiz question based on this transcript:\n\n${transcript}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate quiz');
    }

    const data = await response.json();
    const quizText = data.choices[0].message.content;

    // Parse the quiz text to extract question, options, and explanation
    const lines = quizText.split('\n').filter((line: string) => line.trim());
    const question = lines[0].replace(/^Question:\s*/i, '');
    
    const options: string[] = [];
    let correctAnswer = '';
    let explanation = '';

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^[A-D][.)]\s/)) {
        const option = line.replace(/^[A-D][.)]\s*/, '');
        options.push(option);
        if (line.includes('(correct)') || line.includes('(Correct)')) {
          correctAnswer = option;
        }
      } else if (line.toLowerCase().includes('explanation:')) {
        explanation = line.replace(/^Explanation:\s*/i, '');
      }
    }

    if (!correctAnswer && options.length > 0) {
      correctAnswer = options[0]; // Fallback to first option if no correct answer marked
    }

    return {
      id: Date.now().toString(),
      question,
      options,
      correctAnswer,
      explanation,
      timeLimit: 60 // Default time limit in seconds
    };
  } catch (error) {
    console.error('Error generating quiz:', error);
    // Return a fallback quiz if generation fails
    return {
      id: Date.now().toString(),
      question: 'What was the main topic discussed?',
      options: [
        'The main topic was not clear',
        'The transcript was too short',
        'The audio quality was poor',
        'The speaker was unclear'
      ],
      correctAnswer: 'The main topic was not clear',
      explanation: 'Unable to generate a proper quiz due to technical issues.',
      timeLimit: 60
    };
  }
};

// Helper function to generate a fallback quiz
const generateFallbackQuiz = (transcript: string): Quiz => {
  // Try to extract some key information from the transcript
  const words = transcript.split(' ');
  const keyTopics = words.filter(word => word.length > 5).slice(0, 3);
  
  return {
    id: Date.now().toString(),
    question: keyTopics.length > 0 
      ? `What was discussed about ${keyTopics[0]}?`
      : 'What was the main topic discussed in the transcript?',
    options: [
      'The main topic was not clearly stated',
      'The transcript was unclear',
      'The content was too brief to determine',
      'The transcript needs more context'
    ],
    correctAnswer: 'The transcript needs more context',
    explanation: 'The transcript was too short or unclear to generate a meaningful question.'
  };
};
