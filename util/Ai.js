import OpenAI from "openai";
import fs from "fs";
import sharp from "sharp"; // npm install sharp
import "dotenv/config";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
/** AI logic */
async function preprocessImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);

  const processed = await sharp(imageBuffer)
    .resize(1024, 1024, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .sharpen({
      sigma: 1.2,
      m1: 1.0,
      m2: 0.5,
    })
    .modulate({
      brightness: 1.05,
      saturation: 1.2,
    })
    .png({ quality: 100 })
    .toBuffer();

  return processed.toString("base64");
}

export async function retrieveAiResponse(imagePath, promptText) {
  try {
    const base64Image = await preprocessImage(imagePath);

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a precise image analysis assistant. When analyzing grid-based CAPTCHAs, examine each cell methodically. Return only valid JSON with no explanation or markdown.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    return response.choices[0].message.content;
  } catch (error) {
    if (error.status === 429) {
      console.warn("Rate limited — retrying in 2s...");
      await new Promise((r) => setTimeout(r, 2000));
      return retrieveAiResponse(imagePath, promptText);
    }
    console.error("Error retrieving AI response:", error);
    throw error;
  }
}
