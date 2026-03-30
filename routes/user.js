const express = require("express");
const router = express.Router();
const sql = require("mssql");
const authMiddleware = require("../middleware/auth");

router.put("/voice-settings", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const voiceSettings = req.body;

    await sql.query`
      UPDATE Users
      SET voiceSettings = ${JSON.stringify(voiceSettings)}
      WHERE id = ${userId}
    `;

    res.json({ message: "Voice settings updated successfully", voiceSettings });
  } catch (err) {
    console.error("VOICE SETTINGS UPDATE ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await sql.query`
        SELECT id, email, voiceSettings
        FROM Users
        WHERE id = ${userId}
      `;

    let user = result.recordset[0];

    user.voiceSettings = user.voiceSettings
      ? JSON.parse(user.voiceSettings)
      : null;

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;