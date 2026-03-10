const express = require("express");
const multer = require("multer");
const { speechToText } = require("../services/speechToText");

const router = express.Router();

const { textToSpeech } = require("../services/textToSpeech");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  try {
    const audioBuffer = req.file.buffer;
    const text = await speechToText(audioBuffer);
    res.json({
      success: true,
      text,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Speech recognition failed",
    });
  }
});

router.post("/text-to-speech", async (req, res) => {
  try {
    const { text, voice } = req.body;

    const audioBuffer = await textToSpeech(text, voice);

    res.set({
      "Content-Type": "audio/wav",
      "Content-Length": audioBuffer.length,
    });

    res.send(audioBuffer);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Text to speech failed",
    });
  }
});

module.exports = router;
