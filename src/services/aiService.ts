import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.REACT_APP_OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.REACT_APP_SITE_URL || window.location.origin,
    "X-Title": "Live Transcription Quiz App",
  },
  dangerouslyAllowBrowser: true // Enable browser usage
});

export const generateQuizFromTranscript = async (transcript: string): Promise<{
  question: string;
  options: string[];
}> => {
  try {
    const prompt = `Based on this transcript, generate a multiple choice question with 4 options. Format your response as JSON:
    Transcript: "${transcript}"
    Generate a JSON object with "question" and "options" (array of 4 strings).`;    const completion = await openai.chat.completions.create({
      model: "thudm/glm-z1-9b:free",
      messages: [
        {
          role: "system",
          content: "You are a quiz generator. Generate multiple choice questions based on the given transcript."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    return {
      question: result.question || "Default question if generation fails",
      options: result.options || ["Option A", "Option B", "Option C", "Option D"]
    };
  } catch (error) {
    console.error('Error generating quiz:', error);
    return {
      question: "What was the main topic discussed?",
      options: ["Option A", "Option B", "Option C", "Option D"]
    };
  }
}
