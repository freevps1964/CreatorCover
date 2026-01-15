import { GoogleGenAI, Type } from "@google/genai";
import { BookMetadata, GroundingData, Language, LANGUAGES, MARKETPLACES } from "../types";

// Helper to get a fresh instance (crucial for Veo key selection updates)
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to ensure user has selected an API key (required for Pro Image & Veo models)
const ensureApiKey = async (force: boolean = false) => {
  // Cast window to any to avoid type conflict with existing 'aistudio' property from other definitions
  const win = window as any;
  if (win.aistudio) {
    // Check if hasSelectedApiKey exists before calling
    const hasKey = win.aistudio.hasSelectedApiKey ? await win.aistudio.hasSelectedApiKey() : false;
    // If we are forcing, or if no key is selected, open the dialog
    if (force || !hasKey) {
      if (win.aistudio.openSelectKey) {
        await win.aistudio.openSelectKey();
      }
    }
  }
};

export const researchTrends = async (category: string, topic: string, targetMarket: string, marketplaceId: string, language: Language): Promise<GroundingData> => {
  const ai = getAI();
  const langLabel = LANGUAGES.find(l => l.code === language)?.label || 'English';
  
  // Resolve marketplace name
  const marketplaceName = MARKETPLACES.find(m => m.id === marketplaceId)?.name || 'Amazon';

  // Use targetMarket (Niche) for search if available, otherwise fallback to category
  const searchContext = targetMarket ? targetMarket : `${category} books`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert Art Director for Amazon KDP. 
      Search specifically for the current "Best Sellers in ${searchContext}" on ${marketplaceName}.
      
      1. Analyze the top 3-5 best-selling book covers VISUALLY.
      2. Identify the specific Title and Author of the books you found.
      3. Explain briefly why their cover is working (colors, font, imagery).
      4. Synthesize a trend summary for a new book on topic: "${topic}".
      
      Return a JSON object with:
      - trends: The summary of the visual style.
      - references: An array of the specific books you analyzed (Title, Author, VisualHook).
      
      Language for text fields: ${langLabel}.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trends: { 
              type: Type.STRING, 
              description: "A comprehensive analysis of design trends (colors, typography, composition)."
            },
            references: {
              type: Type.ARRAY,
              description: "List of real books found in the search that served as inspiration.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  author: { type: Type.STRING },
                  visualHook: { type: Type.STRING, description: "Short description of the cover's key visual element (e.g., 'Big yellow serif text on blue background')" }
                }
              }
            }
          }
        }
      },
    });

    // Parse the JSON structure
    const data = JSON.parse(response.text || '{"trends": "", "references": []}');
    
    // Get grounding sources (links)
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
      .filter(Boolean) || [];

    return { 
      trends: data.trends || "Analysis complete.", 
      references: data.references || [],
      sources 
    };

  } catch (error) {
    console.error("Trend research failed", error);
    return { 
      trends: "Unable to fetch live trends. Using general design principles.", 
      references: [],
      sources: [] 
    };
  }
};

export const generateBookText = async (topic: string, category: string, author: string, language: Language): Promise<Partial<BookMetadata>> => {
  const ai = getAI();
  const langLabel = LANGUAGES.find(l => l.code === language)?.label || 'English';

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate catchy book metadata for a bestseller in "${category}" about "${topic}" by author "${author}".
    Return ONLY a JSON object with keys: title, subtitle, description.
    
    Language: ${langLabel}.
    
    - title: Catchy, memorable, fits the genre, in ${langLabel}.
    - subtitle: Explains the value proposition or hook, in ${langLabel}.
    - description: A short, punchy, motivational blurb (max 25 words) for the front cover, in ${langLabel}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          description: { type: Type.STRING }
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { title: "Untitled", subtitle: "", description: "" };
  }
};

// Internal helper for a single image call
const generateSingleImage = async (prompt: string, retry: boolean): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "9:16",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated in this attempt");
  } catch (error: any) {
    // Check for permission denied error
    if (retry && (error.message?.includes('403') || error.status === 403 || error.message?.includes('PERMISSION_DENIED'))) {
      console.log("Permission denied, prompting for key selection again...");
      await ensureApiKey(true); // Force re-selection
      return generateSingleImage(prompt, false); // Retry once
    }
    throw error;
  }
};

export const generateCoverImages = async (prompt: string): Promise<string[]> => {
  // Initial check for key
  await ensureApiKey(); 
  
  try {
    // Run 3 parallel requests to get variations
    // Gemini 3 Pro image generation typically returns 1 image, so we call it 3 times.
    const promises = [1, 2, 3].map(() => generateSingleImage(prompt, true));
    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error("Image generation failed", error);
    throw error;
  }
};

export const editCoverImage = async (imageBase64: string, instruction: string): Promise<string> => {
  const ai = getAI();
  // "Nano banana powered app" - Use Gemini 2.5 Flash Image for editing
  const cleanBase64 = imageBase64.split(',')[1];
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
            }
          },
          { text: instruction }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No edited image returned");
  } catch (error) {
    console.error("Image editing failed", error);
    throw error;
  }
};

export const generateVeoVideo = async (imageBase64: string, prompt: string): Promise<string> => {
  await ensureApiKey(); // Ensure key is selected for Veo
  
  const generate = async (retry: boolean) => {
    const ai = getAI(); // Get fresh instance with potential new key
    const cleanBase64 = imageBase64.split(',')[1];

    try {
      // Using veo-3.1-fast-generate-preview as requested
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt || "Cinematic camera movement bringing this book cover to life.",
        image: {
          imageBytes: cleanBase64,
          mimeType: 'image/png',
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '9:16' // Portrait for Reels/Shorts/TikTok marketing
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) throw new Error("Video generation failed to return URI");

      // Fetch the actual video bytes using the API key
      const videoResponse = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
      if (!videoResponse.ok) {
         if (videoResponse.status === 403) throw new Error("PERMISSION_DENIED");
         throw new Error(`Video fetch failed: ${videoResponse.statusText}`);
      }
      const videoBlob = await videoResponse.blob();
      return URL.createObjectURL(videoBlob);
    } catch (error: any) {
       // Check for permission denied error
      if (retry && (error.message?.includes('403') || error.status === 403 || error.message?.includes('PERMISSION_DENIED'))) {
        console.log("Permission denied for Veo, prompting for key selection again...");
        await ensureApiKey(true); // Force re-selection
        return generate(false); // Retry once
      }
      throw error;
    }
  };

  try {
     return await generate(true);
  } catch (error) {
    console.error("Veo generation failed", error);
    throw error;
  }
};