// Check if API key is available
const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
if (!apiKey) {
  console.warn('OpenRouter API key is missing. Quiz generation will use fallback questions.');
}

import { Quiz } from '../types/index';

export const generateQuizFromTranscript = async (transcript: string): Promise<Quiz> => {
  // If no API key is available, return a fallback question
  if (!apiKey) {
    return generateFallbackQuiz(transcript);
  }

  try {
    const prompt = `Based on the following transcript, generate a relevant multiple-choice question that tests understanding of the main points discussed. The question should be clear, specific, and have exactly one correct answer.

Transcript: "${transcript}"

Generate a question in the following JSON format:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "The correct option",
  "explanation": "A brief explanation of why this is the correct answer"
}

Make sure the question is directly related to the content of the transcript and tests understanding of key concepts or important details.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Live Poll App'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-opus-20240229',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates educational quiz questions based on transcripts. Focus on creating questions that test understanding of key concepts and important details.'
          },
          {
            role: 'user',
            content: prompt
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
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }    try {
      const quizData = JSON.parse(content);
      if (!quizData.question || !quizData.options || !quizData.correctAnswer || !quizData.explanation) {
        throw new Error('Invalid quiz format');
      }
      
      // Add id to the quiz
      const quiz: Quiz = {
        id: Date.now().toString(),
        question: quizData.question,
        options: quizData.options,
        correctAnswer: quizData.correctAnswer,
        explanation: quizData.explanation
      };
      
      return quiz;
    } catch (error) {
      console.error('Error parsing quiz:', error);
      return generateFallbackQuiz(transcript);
    }
  } catch (error) {
    console.error('Error generating quiz:', error);
    return generateFallbackQuiz(transcript);
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
