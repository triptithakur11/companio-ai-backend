const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs");
const { convertToWav } = require("./convertToWav");

async function speechToText(audioBuffer) {
  const wavPath = await convertToWav(audioBuffer);

  let recognizer;

  try {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_TEXT_KEY,
      process.env.AZURE_SPEECH_TEXT_REGION,
    );

    speechConfig.speechRecognitionLanguage = "en-US";

    const audioBufferWav = fs.readFileSync(wavPath);
    const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBufferWav);

    recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    const result = await new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(resolve, reject);
    });

    if (result.reason === sdk.ResultReason.RecognizedSpeech) {
      return result.text;
    } else {
      // console.log("STT ERROR:", result);
      return "";
    }
  } catch (err) {
    console.error("STT FAIL:", err);
    throw err;
  } finally {
    if (recognizer) recognizer.close();

    try {
      if (fs.existsSync(wavPath)) {
        fs.unlinkSync(wavPath);
      }
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  }
}

module.exports = { speechToText };