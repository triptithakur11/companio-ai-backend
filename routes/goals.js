const express = require("express");
const axios = require("axios");
const sql = require("mssql");
const { ClientSecretCredential } = require("@azure/identity");
const authMiddleware = require("../middleware/auth");
require("dotenv").config();

const router = express.Router();

const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID,
  process.env.AZURE_CLIENT_ID,
  process.env.AZURE_CLIENT_SECRET,
);

router.post("/generate/:chatId", authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;

    const history = await sql.query`
      SELECT role, content
      FROM Messages
      WHERE chatId = ${chatId}
      ORDER BY createdAt ASC
    `;

    const chatText = history.recordset
      .slice(-8)
      .map((m) => {
        let parsed;
        try {
          parsed = JSON.parse(m.content);
        } catch {
          parsed = { text: m.content };
        }
        return `${m.role}: ${parsed.text || ""}`;
      })
      .join("\n");

    const prompt = `
You are an AI task planner that converts conversations into actionable tasks.

Your job is to analyze the conversation and extract practical tasks that help the user achieve their objective.

Important rules:

1. Ignore greetings, filler text, empty messages, voice placeholders, and irrelevant chat.
2. Focus only on meaningful actions the user should perform.
3. Break large goals into smaller actionable tasks.
4. Each task should represent a clear action the user can execute.
5. Avoid vague tasks like "improve skills" or "learn more".
6. Prefer tasks such as: learn, practice, research, build, prepare, apply, schedule, review, etc.
7. Tasks must be short and clear (5–12 words).
8. Do not repeat similar tasks.
9. Limit to a maximum of 10 tasks.
10. Prioritize tasks that move the user closer to their objective.

For each task include:
- title (short actionable task)
- priority (high | medium | low)
- category (learning | practice | project | preparation | research)
- isDone (always false)

Return ONLY valid JSON in the exact format below.

{
  "goals": [
    {
      "title": "Task description",
      "priority": "high",
      "category": "learning",
      "isDone": false
    }
  ]
}

Conversation:
${chatText}
`;

    const tokenResponse = await credential.getToken(
      "https://ai.azure.com/.default",
    );

    const aiResponse = await axios.post(
      process.env.AZURE_GOAL_AGENT_ENDPOINT,
      { input: prompt },
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.token}`,
          "Content-Type": "application/json",
        },
        responseType: "text",
        transformResponse: [(data) => data],
      },
    );

    const parsedResponse = JSON.parse(aiResponse.data);

    const message = parsedResponse.output.find(
      (item) => item.type === "message",
    );

    const reply = message?.content?.[0]?.text;

    let goals;

    try {
      goals = JSON.parse(reply);
    } catch {
      goals = { goals: [] };
    }

    res.json(goals);
  } catch (err) {
    console.error("Generate goals error:", err);

    res.status(500).json({ error: "Failed to generate goals" });
  }
});

router.post("/save", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { goals } = req.body;

    if (!Array.isArray(goals)) {
      return res.status(400).json({ error: "Goals must be array" });
    }

    const goalsJson = JSON.stringify(goals);

    const existing = await sql.query`
      SELECT id FROM UserGoals WHERE userId = ${userId}
    `;

    if (existing.recordset.length > 0) {
      await sql.query`
        UPDATE UserGoals
        SET goalsJson = ${goalsJson},
            updatedAt = GETDATE()
        WHERE userId = ${userId}
      `;
    } else {
      await sql.query`
        INSERT INTO UserGoals (userId, goalsJson)
        VALUES (${userId}, ${goalsJson})
      `;
    }

    res.json({ message: "Goals saved successfully" });
  } catch (err) {
    console.error("Save goals error:", err);
    res.status(500).json({ error: "Failed to save goals" });
  }
});

router.put("/update", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { goals } = req.body;

    if (!Array.isArray(goals)) {
      return res.status(400).json({ error: "Goals must be an array" });
    }

    // Basic validation
    for (let goal of goals) {
      if (typeof goal.title !== "string" || typeof goal.isDone !== "boolean") {
        return res.status(400).json({ error: "Invalid goal format" });
      }
    }

    const goalsJson = JSON.stringify(goals);

    const existing = await sql.query`
      SELECT id FROM UserGoals WHERE userId = ${userId}
    `;

    if (existing.recordset.length === 0) {
      return res.status(404).json({ error: "Goals not found" });
    }

    await sql.query`
      UPDATE UserGoals
      SET goalsJson = ${goalsJson},
          updatedAt = GETDATE()
      WHERE userId = ${userId}
    `;

    res.json({
      message: "Goals updated successfully",
      goals,
    });
  } catch (err) {
    console.error("Update goals error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await sql.query`
      SELECT goalsJson FROM UserGoals
      WHERE userId = ${req.user.id}
    `;

    if (result.recordset.length === 0) {
      return res.json({ goals: [] });
    }

    const goals = JSON.parse(result.recordset[0].goalsJson);

    res.json({ goals });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
