const express = require("express");
const axios = require("axios");
const sql = require("mssql");
const authMiddleware = require("../middleware/auth");
require("dotenv").config();

const router = express.Router();

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
      You are an expert AI productivity coach and task planner.
      
      Your job is to deeply analyze the conversation and extract ONLY high-quality, practical, and logical goals that directly help the user achieve their objective.
      
      STRICT RULES (VERY IMPORTANT):
      
      1. Identify the USER'S CORE OBJECTIVE first (ignore assistant replies unless needed for clarity).
      2. Generate goals ONLY if they clearly contribute toward that objective.
      3. NEVER generate generic, vague, or filler tasks.
         ❌ Bad: "Improve skills", "Learn more", "Work hard"
         ✅ Good: "Solve 5 binary search problems on LeetCode"
      
      4. Each goal MUST:
         - Be realistic and actionable
         - Represent a clear real-world step
         - Be specific enough that user knows exactly what to do
         - Be outcome-driven (not abstract intention)
      
      5. Break large goals into meaningful smaller steps ONLY if necessary.
      6. Do NOT create unnecessary or redundant goals.
      7. Avoid repeating similar tasks in different wording.
      8. Max 8–10 goals ONLY (quality over quantity).
      9. Ignore greetings, filler text, empty messages, or noise.
      10. If conversation lacks clarity → generate only highly confident goals.
      
      PRIORITY RULES:
      - high → critical steps that directly move user forward
      - medium → supportive but important steps
      - low → optional or secondary improvements
      
      CATEGORY RULES:
      - learning → studying concepts
      - practice → solving problems / exercises
      - project → building something
      - preparation → planning, resume, interviews, applications
      - research → exploring options, comparing, gathering info
      
      OUTPUT RULES:
      - Titles MUST be 5–12 words
      - Use strong action verbs (build, solve, implement, revise, apply, etc.)
      - Keep language simple and direct
      - No extra explanation, ONLY JSON
      
      Return strictly in this format:
      
      {
        "goals": [
          {
            "title": "Clear actionable task",
            "priority": "high",
            "category": "practice",
            "isDone": false
          }
        ]
      }
      
      Conversation:
      ${chatText}
      `;

    const aiResponse = await axios.post(
      process.env.AZURE_GOAL_AGENT_ENDPOINT,
      { input: prompt },
      {
        headers: {
          "api-key": process.env.AZURE_AGENT_KEY,
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