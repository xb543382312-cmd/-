import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded GoogleGenAI Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// AI Assist Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, systemPrompt, conversationHistory } = req.body;
    
    // Check key presence first
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({ 
        success: true, 
        isMock: true,
        text: `您好！我是龙里县网格管理智能助手。对于您关于“${message}”的咨询，根据龙里县的政策惯例，基层治理工作应以人民为中心，积极推进网格化管理与精细化服务。具体的政策需要结合相关部门的最新的通知文件，请指引我了解更多细节。`
      });
    }

    const ai = getGeminiClient();
    
    // Construct request contents
    // Feed conversation history & system prompt
    const contents: any[] = [];
    
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: any) => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt || "您是龙里县网格管理智能助手，一个专门为中国贵州省黔南布依族苗族自治州龙里县基层干部、社区网格员和居民设计的政务助理。你以专业、严谨、谦和、高效的态度，解答关于基层社会治理、社区服务、惠民政策、文件撰写（如通知、工作方案、工作总结、答复函等）的咨询。对于不清楚的具体政策文件，保持实事求是的作风。"
      }
    });

    res.json({
      success: true,
      text: response.text || "无法生成回复，请重试。"
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "服务器内部错误" 
    });
  }
});

// Start the dev/production serving chain
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[龙里县网格管理智能助手] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
