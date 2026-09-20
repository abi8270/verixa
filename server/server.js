const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.get("/", (req, res) => {
  res.json({
    message: "VERIXA AI backend is running successfully!"
  });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a message to analyze."
      });
    }

    const prompt = `
You are VERIXA, an AI-powered scam and fraud message detection system.

Analyze the following message carefully.

MESSAGE:
"""
${message}
"""

Return ONLY valid JSON in exactly this structure:

{
  "riskScore": 0,
  "riskLevel": "SAFE",
  "scamType": "None",
  "redFlags": [],
  "recommendations": []
}

Rules:

1. riskScore must be a number from 0 to 100.
2. riskLevel must be exactly one of:
   "SAFE", "SUSPICIOUS", "HIGH RISK"
3. Identify the most likely scam type.
4. Give 3 to 5 specific red flags based on the actual message.
5. Give 2 to 4 practical safety recommendations.
6. Do not invent details that are not present in the message.
7. Consider urgency, suspicious links, OTP requests, money requests,
   impersonation, rewards, job scams, delivery scams, banking fraud,
   investment scams and social engineering.
8. If the message appears legitimate, explain that through the redFlags
   and keep the risk score low.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt
    });

    let resultText = response.text;

    resultText = resultText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const result = JSON.parse(resultText);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error("Gemini API Error:", error);

    res.status(500).json({
      success: false,
      message: "AI analysis failed. Please try again."
    });
  }
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`VERIXA backend running on http://localhost:${PORT}`);
});