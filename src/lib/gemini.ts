import { GoogleGenAI, Type } from "@google/genai";

// Initialize AI with the key from environment
// Note: Skill says to create a new instance right before making an API call
// but we can have a helper to get the instance.
export const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please select an API key.");
  }
  return new GoogleGenAI({ apiKey });
};

export interface Scene {
  id: string;
  description: string;
  duration: number;
}

export async function breakdownPromptIntoScenes(prompt: string): Promise<Scene[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Break down the following video prompt into a sequence of 8-second cinematic scenes. 
    Each scene should have a clear description for a video generation model.
    Prompt: "${prompt}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            description: { type: Type.STRING },
            duration: { type: Type.NUMBER, description: "Duration in seconds, should be 8" }
          },
          required: ["id", "description", "duration"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse scenes", e);
    return [];
  }
}

export async function generateAudioForVideo(prompt: string): Promise<string | null> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Generate a cinematic narration or background description for this video: ${prompt}` }] }],
      config: {
        responseModalities: ["AUDIO" as any],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio ? `data:audio/mpeg;base64,${base64Audio}` : null;
  } catch (e) {
    console.error("Audio generation failed", e);
    return null;
  }
}
