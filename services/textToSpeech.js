const sdk = require("microsoft-cognitiveservices-speech-sdk");

async function textToSpeech(text) {

  return new Promise((resolve, reject) => {

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_TEXT_SPEECH_KEY,
      process.env.AZURE_TEXT_SPEECH_REGION
    );

    speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";

    const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    synthesizer.speakTextAsync(
      text,
      result => {

        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {

          const audioBuffer = Buffer.from(result.audioData);

          resolve(audioBuffer);

        } else {
          reject("Speech synthesis failed");
        }

        synthesizer.close();

      },
      err => {
        synthesizer.close();
        reject(err);
      }
    );

  });

}

module.exports = { textToSpeech };