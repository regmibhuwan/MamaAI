import { GoogleGenAI, Type } from "@google/genai";
import { Recipe } from "../types";

// Initialize the standard client for non-streaming generation
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const RECIPE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    recipes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          time: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
          calories: { type: Type.STRING },
          ingredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          equipment: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["id", "title", "description", "time", "difficulty", "ingredients", "steps"],
      },
    },
  },
};

export const suggestRecipes = async (
  inputText: string,
  imageBase64?: string
): Promise<Recipe[]> => {
  const modelId = "gemini-2.5-flash"; // Good balance of speed and logic for planning
  
  const promptText = `
    You are an expert chef. Based on the provided ingredients or request, suggest 3 distinct, delicious recipes.
    Ensure they are practical for home cooking.
    User Input: "${inputText}"
  `;

  const parts: any[] = [{ text: promptText }];

  if (imageBase64) {
    parts.unshift({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64,
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        role: "user",
        parts: parts,
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RECIPE_SCHEMA,
        systemInstruction: "Return a JSON object with a 'recipes' array.",
      },
    });

    const text = response.text;
    if (!text) return [];
    
    const parsed = JSON.parse(text);
    return parsed.recipes || [];
  } catch (error) {
    console.error("Error fetching recipes:", error);
    return [];
  }
};