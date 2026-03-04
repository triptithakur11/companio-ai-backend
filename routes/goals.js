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
    const userId = req.user.id;

    const history = await sql.query`
      SELECT role, content
      FROM Messages
      WHERE chatId = ${chatId}
      ORDER BY createdAt ASC
    `;

    const chatText = history.recordset
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const prompt = `
Convert the following conversation into small clear goals.
Return ONLY JSON in this format:

{
  "goals": [
    { "title": "goal 1", "isDone": false },
    { "title": "goal 2", "isDone": false }
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
      {
        model: "gpt-4.1",
        input: prompt,
      },
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = aiResponse?.data?.output?.filter(
      (item) => item?.type === "message",
    )[0];

    const reply = data?.content[0]?.text;

    const parsed = JSON.parse(reply);

    res.json(parsed);
  } catch (err) {
    // console.error("Generate goals error:", err);
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
