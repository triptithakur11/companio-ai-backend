const sdk = require("microsoft-cognitiveservices-speech-sdk");
require("dotenv").config();

async function textToSpeech(text, voice = "female") {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_TEXT_SPEECH_KEY,
      process.env.AZURE_TEXT_SPEECH_REGION,
    );

    // voice selection
    const voices = {
      female: "en-US-JennyNeural",
      male: "en-US-GuyNeural",
    };

    speechConfig.speechSynthesisVoiceName = voices[voice] || voices.female;

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    synthesizer.speakTextAsync(
      text,
      (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          resolve(Buffer.from(result.audioData));
        } else {
          reject("TTS failed");
        }

        synthesizer.close();
      },
      (err) => reject(err),
    );
  });
}

module.exports = { textToSpeech };