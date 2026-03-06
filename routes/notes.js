const express = require("express");
const authMiddleware = require("../middleware/auth");
require("dotenv").config();
const router = express.Router();
const sql = require("mssql");
const multer = require("multer");
const upload = multer();
const { translateText } = require("../services/translator");
const { uploadToBlob } = require("../services/blobService");
const { extractText } = require("../services/documentService");

router.post(
  "/smart-notes",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const { targetLang } = req.body;

      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      // 1️⃣ Upload to Blob
      const blobUrl = await uploadToBlob(req.file);

      // 2️⃣ Extract Text
      const extractedText = await extractText(req.file.buffer);
      // Translate Text
      const translatedText = targetLang
        ? await translateText(extractedText, targetLang)
        : extractText;
      console.log(translatedText);
      // 3️⃣ Create Chat with Agent 2
      const chatResult = await sql.query`
      INSERT INTO Chats (userId, agentId, title, fileUrl, fileText)
      OUTPUT INSERTED.id
      VALUES (${userId}, 6, ${req.file.originalname}, ${blobUrl}, ${translatedText})
    `;

      const chatId = chatResult.recordset[0].id;

      res.json({
        message: "File uploaded successfully",
        chatId,
        blobUrl,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

router.post("/extract-notes", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const extractedText = await extractText(req.file.buffer);

    res.json({
      message: "Text extracted successfully",
      text: extractedText,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Extraction failed" });
  }
});

module.exports = router;
