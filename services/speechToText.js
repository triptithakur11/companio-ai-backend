const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs");
const { convertToWav } = require("./convertToWav");

async function speechToText(audioBuffer) {

  const wavPath = await convertToWav(audioBuffer);

  return new Promise((resolve, reject) => {

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_TEXT_KEY,
      process.env.AZURE_SPEECH_TEXT_REGION
    );

    speechConfig.speechRecognitionLanguage = "en-US";

    const audioBufferWav = fs.readFileSync(wavPath);

    const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBufferWav);

    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizeOnceAsync(result => {

      if (result.reason === sdk.ResultReason.RecognizedSpeech) {
        resolve(result.text);
      } else {
        resolve("");
      }

      recognizer.close();

    }, err => {
      recognizer.close();
      reject(err);
    });

  });

}

module.exports = { speechToText };