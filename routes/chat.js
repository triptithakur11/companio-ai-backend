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

/* -------------------- SEND MESSAGE -------------------- */

router.post(
  "/:chatId/:agentId/message",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const { chatId, agentId } = req.params;
      const { message, targetLang } = req.body;
      console.log(req.file);
      console.log(req.body);
      let extractedText = "";

      if (req.file) {
        extractedText = await extractText(req.file.buffer);
      }

      if (!message && !req.file) {
        return res.status(400).json({ error: "Message or file required" });
      }

      const translatedText = message
        ? targetLang
          ? await translateText(message, targetLang)
          : message
        : "";

      await sql.query`
        INSERT INTO Messages (chatId, role, content)
        VALUES (${chatId}, 'user', ${translatedText || extractedText})
      `;

      const chatResult = await sql.query`
      SELECT * FROM Chats WHERE id=${chatId}
    `;

      if (chatResult.recordset.length === 0) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const chat = chatResult.recordset[0];
      const fileContext = chat.fileText
        ? `
The user uploaded the following academic document.
Use this as primary source of truth.

DOCUMENT:
---------
${chat.fileText}
---------
`
        : "";
      // 3️⃣ Get agent
      const agentResult = await sql.query`
      SELECT * FROM Agents WHERE id=${agentId}
    `;

      if (agentResult.recordset.length === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const agent = agentResult.recordset[0];
      const historyResult = await sql.query`
        SELECT role, content
        FROM Messages
        WHERE chatId=${chatId}
        ORDER BY createdAt ASC
      `;

      const conversationText = `
${systemPrompt}

${fileContext}

${historyResult.recordset
  .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
  .join("\n")}
`;

      const tokenResponse = await credential.getToken(
        "https://ai.azure.com/.default",
      );
      if (!tokenResponse?.token) {
        return res.status(500).json({ error: "Failed to get Azure token" });
      }

      const aiResponse = await axios.post(
        endpoints[agentId],
        { input: conversationText },
        {
          headers: {
            Authorization: `Bearer ${tokenResponse.token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const output = aiResponse.data?.output?.find(
        (item) => item.type === "message",
      );

      const reply = output?.content?.[0]?.text;
      if (!reply) {
        return res.status(500).json({ error: "No AI reply received" });
      }
      await sql.query`
        INSERT INTO Messages (chatId, role, content)
        VALUES (${chatId}, 'assistant', ${reply})
      `;

      res.json({ reply });
    } catch (err) {
      console.error("AZURE ERROR:", err.response?.data || err.message);
      res.status(500).json({ error: "Agent failed" });
    }
  },
);

module.exports = router;
router.get("/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    // Check if chat belongs to user
    const chatCheck = await sql.query`
      SELECT id FROM Chats 
      WHERE id = ${chatId} AND userId = ${userId}
    `;

    if (chatCheck.recordset.length === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Fetch messages (only necessary fields)
    const messages = await sql.query`
      SELECT role, content, createdAt
      FROM Messages
      WHERE chatId = ${chatId}
      ORDER BY createdAt ASC
    `;

    res.json(messages.recordset);
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
