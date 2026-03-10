const express = require("express");
const axios = require("axios");
const sql = require("mssql");
const { ClientSecretCredential } = require("@azure/identity");
const authMiddleware = require("../middleware/auth");
const { translateText } = require("../services/translator");
const { extractText } = require("../services/documentService");
const { uploadToBlob } = require("../services/blobService");
require("dotenv").config();

const router = express.Router();
const multer = require("multer");
const { checkSafety } = require("../services/checkContentSafety");
const { speechToText } = require("../services/speechToText");

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
});

module.exports = upload;

const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID,
  process.env.AZURE_CLIENT_ID,
  process.env.AZURE_CLIENT_SECRET,
);

const endpoints = {
  1: process.env.AZURE_GOAL_AGENT_ENDPOINT,
  2: process.env.AZURE_SMART_REV_AGENT_ENDPOINT,
  3: process.env.AZURE_CONCEPT_SIMPLIFIER_AGENT_ENDPOINT,
  4: process.env.AZURE_CURATED_RES_AGENT_ENDPOINT,

  5: process.env.AZURE_HUMAN_SUPPORT_AGENT_ENDPOINT,
  6: process.env.AZURE_SMART_NOTES_AGENT_ENDPOINT,
};

const systemPrompt = `
You are Companio, an advanced academic study assistant.

Your capabilities:
- Reconstruct messy notes into structured study material
- Create short notes
- Create detailed notes
- Summarize content
- Expand explanations
- Generate revision sheets
- Generate exam questions
- Explain concepts step-by-step

Rules:
- Keep language simple but academically accurate.
- Use headings and subheadings.
- Use bullet points where helpful.
- Highlight key terms in bold.
- If mathematical content appears, format equations clearly.
- If subject is unclear, infer the most likely academic field.
- Do not repeat content unnecessarily.
- Adapt depth based on user request (short, detailed, summary, etc.).
`;
/* -------------------- CREATE CHAT -------------------- */

router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { userId, agentId, title } = req.body;

    const result = await sql.query`
      INSERT INTO Chats (userId, agentId, title)
      OUTPUT INSERTED.id
      VALUES (${userId}, ${agentId}, ${title})
    `;

    res.json({ chatId: result.recordset[0].id });
  } catch (err) {
    console.log("CREATE CHAT ERROR:", err);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

router.post(
  "/:chatId/:agentId/message",
  authMiddleware,
  upload.fields([
    { name: "files", maxCount: 10 },
    { name: "voice", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { chatId, agentId } = req.params;
      const { message, targetLang } = req.body;

      let filesUrls = [];
      let voiceUrl = null;
      let extractedText = "";

      const files = req.files?.files || [];
      const voice = req.files?.voice?.[0];

      // Upload multiple files
      for (const file of files) {
        const url = await uploadToBlob(file, "notes");
        filesUrls.push(url);
        const text = await extractText(file.buffer);
        extractedText += "\n" + text;
      }

      // Upload voice file
      let voiceText = "";

      if (voice) {
        voiceUrl = await uploadToBlob(voice, "voice");
        voiceText = await speechToText(voice.buffer);
      }

      if (!message && files.length === 0 && !voice) {
        return res
          .status(400)
          .json({ error: "Message, file or voice required" });
      }

      extractedText = extractedText
        ? targetLang
          ? await translateText(extractedText, targetLang)
          : extractedText
        : "";

      const translatedText = message
        ? targetLang
          ? await translateText(message, targetLang)
          : message
        : "";

      const finalText = extractedText + " " + translatedText + " " + voiceText;

      const content = {
        text: finalText || null,
        files: filesUrls,
        voice: voiceUrl,
      };

      // Save user message
      await sql.query`
        INSERT INTO Messages (chatId, role, content)
        VALUES (${chatId}, 'user', ${JSON.stringify(content)})
      `;

      const safety = await checkSafety({
        text: message,
        file: files?.[0],
        voice: voice,
      });

      if (safety) {
        const unsafe = safety.categoriesAnalysis?.some((c) => c.severity >= 2);

        if (unsafe) {
          return res.status(400).json({
            error: "Content violates safety policy",
          });
        }
      }

      // ---------- CHAT HISTORY ----------
      const historyResult = await sql.query`
        SELECT role, content
        FROM Messages
        WHERE chatId=${chatId}
        ORDER BY createdAt ASC
      `;

      const conversationText = `
        ${systemPrompt}
        ${historyResult.recordset
          .map((m) => {
            let parsed;

            try {
              parsed = JSON.parse(m.content);
            } catch {
              parsed = { text: m.content };
            }

            return `${m.role.toUpperCase()}: ${parsed.text || ""}`;
          })
          .join("\n")}
        `;

      const tokenResponse = await credential.getToken(
        "https://ai.azure.com/.default",
      );

      const aiResponse = await axios.post(
        endpoints[agentId],
        { input: conversationText },
        {
          headers: {
            Authorization: `Bearer ${tokenResponse.token}`,
            "Content-Type": "application/json",
          },
          responseType: "text",
          transformResponse: [(data) => data],
        },
      );

      let reply = "";

      try {
        const parsed = JSON.parse(aiResponse.data);
        const output = parsed?.output?.find((item) => item.type === "message");
        reply = output?.content?.[0]?.text;
      } catch {
        reply = aiResponse.data;
      }

      // const voiceBuffer = await textToSpeech(reply);
      // const aiVoiceFile = {
      //   buffer: voiceBuffer,
      //   originalname: `ai-${Date.now()}.wav`,
      //   mimetype: "audio/wav",
      // };

      // const aiVoiceUrl = await uploadToBlob(aiVoiceFile, "voice");

      const assistantContent = {
        text: reply,
        files: filesUrls,
        voice: null,
      };

      await sql.query`
        INSERT INTO Messages (chatId, role, content)
        VALUES (${chatId}, 'assistant', ${JSON.stringify(assistantContent)})
      `;

      res.json({
        reply,
        voiceUrl: null,
        filesUrls,
      });
    } catch (err) {
      if (err.response) {
        let errorMessage = err.response.data;

        if (Buffer.isBuffer(errorMessage)) {
          errorMessage = errorMessage.toString();
        }

        console.error("AZURE ERROR:", err.response.status, errorMessage);
      } else {
        console.error("SERVER ERROR:", err.message);
      }

      res.status(500).json({ error: "Agent failed" });
    }
  },
);

router.get("/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    // Check chat ownership
    const chatCheck = await sql.query`
      SELECT id FROM Chats
      WHERE id = ${chatId} AND userId = ${userId}
    `;

    if (chatCheck.recordset.length === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Fetch messages
    const result = await sql.query`
      SELECT role, content, createdAt
      FROM Messages
      WHERE chatId = ${chatId}
      ORDER BY createdAt ASC
    `;

    const messages = result.recordset.map((msg) => {
      let parsed;

      try {
        parsed = JSON.parse(msg.content);
      } catch {
        // fallback for old messages
        parsed = {
          text: msg.content,
          voice: null,
          file: [],
        };
      }

      return {
        role: msg.role,
        text: parsed.text || null,
        voice: parsed.voice || null,
        files: parsed.files || [],
        createdAt: msg.createdAt,
      };
    });

    res.json(messages);
  } catch (error) {
    console.error("Fetch messages error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:chatId/reset", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    // Verify ownership
    const chatCheck = await sql.query`
      SELECT id FROM Chats
      WHERE id = ${chatId} AND userId = ${userId}
    `;

    if (chatCheck.recordset.length === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Delete messages only
    await sql.query`
      DELETE FROM Messages
      WHERE chatId = ${chatId}
    `;

    res.json({ message: "Chat history reset successfully" });
  } catch (err) {
    console.error("Reset error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
