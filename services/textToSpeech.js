// const sdk = require("microsoft-cognitiveservices-speech-sdk");

// async function textToSpeech(text, voice = "female") {
//   return new Promise((resolve, reject) => {

//     const speechConfig = sdk.SpeechConfig.fromSubscription(
//       process.env.AZURE_TEXT_SPEECH_KEY,
//       process.env.AZURE_TEXT_SPEECH_REGION
//     );

//     // voice selection
//     const voices = {
//       female: "en-US-JennyNeural",
//       male: "en-US-GuyNeural"
//     };

//     speechConfig.speechSynthesisVoiceName =
//       voices[voice] || voices.female;

//     // output audio as buffer instead of playing on server
//     const audioConfig = sdk.AudioConfig.fromAudioFileOutput("temp.wav");

//     const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

//     synthesizer.speakTextAsync(
//       text,
//       (result) => {

//         if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {

//           const audioBuffer = Buffer.from(result.audioData);

//           resolve(audioBuffer);

//         } else {
//           reject("Speech synthesis failed");
//         }

//         synthesizer.close();
//       },
//       (err) => {
//         synthesizer.close();
//         reject(err);
//       }
//     );
//   });
// }

// module.exports = { textToSpeech };

const sdk = require("microsoft-cognitiveservices-speech-sdk");
require("dotenv").config();

async function textToSpeech(text) {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_TEXT_SPEECH_KEY,
      process.env.AZURE_TEXT_SPEECH_REGION,
    );

    speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";

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
