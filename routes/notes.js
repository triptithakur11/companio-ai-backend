const express = require("express");
const authMiddleware = require("../middleware/auth");
require("dotenv").config();
const router = express.Router();
const sql = require("mssql");
const multer = require("multer");
const upload = multer();
const OpenAI = require("openai");
const {translateText} = require("../services/translator");
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPEN_AI_KEY,
  baseURL: `${process.env.AZURE_OPEN_AI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPEN_AI_DEPLOYMENT}`,
  defaultQuery: { "api-version": "2024-02-15-preview" },
  defaultHeaders: {
    "api-key": process.env.AZURE_OPEN_AI_KEY,
  },
});
const { BlobServiceClient } = require("@azure/storage-blob");

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING,
);

const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER,
);

const {
  DocumentAnalysisClient,
  AzureKeyCredential,
} = require("@azure/ai-form-recognizer");

const docClient = new DocumentAnalysisClient(
  process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_DOC_INTELLIGENCE_KEY),
);

async function extractText(fileBuffer) {
  const poller = await docClient.beginAnalyzeDocument(
    "prebuilt-document",
    fileBuffer,
  );

  const result = await poller.pollUntilDone();

  let fullText = "";

  for (const page of result.pages) {
    for (const line of page.lines) {
      fullText += line.content + "\n";
    }
  }

  return fullText;
}

async function reconstructNotes(rawText) {
  const prompt = `
You are an academic reconstruction expert.

TASK:
1. Identify subject automatically.
2. Detect incomplete explanations.
3. Add missing key academic concepts.
4. Structure notes properly with headings.
5. Add bullet points for revision.
6. End with Quick Revision Summary.

Keep language simple but accurate.

Here are the messy notes:
${rawText}
`;

  const response = await openai.chat.completions.create({
    model: process.env.AZURE_OPEN_AI_DEPLOYMENT,
    messages: [
      { role: "system", content: "You are Companio, an AI study assistant." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return response.choices[0].message.content;
}

async function uploadToBlob(file) {
  const blobName = `${Date.now()}-${file.originalname}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype,
    },
  });

  return blockBlobClient.url;
}

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
      const translatedText = targetLang?await translateText(extractedText, targetLang):extractText;
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
