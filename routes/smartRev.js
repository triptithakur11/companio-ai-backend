const express = require("express");
const multer = require("multer");
const { speechToText } = require("../services/speechToText");

const router = express.Router();

const { textToSpeech } = require("../services/textToSpeech");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  try {
    const audioBuffer = req.file.buffer;
console.log("Audio size:", audioBuffer.length);
    const text = await speechToText(audioBuffer);
console.log(text);
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
    const { text } = req.body;

    const audioBuffer = await textToSpeech(text);

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
