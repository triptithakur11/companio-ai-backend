const sdk = require("microsoft-cognitiveservices-speech-sdk");

async function speechToText(audioBuffer) {

  return new Promise((resolve, reject) => {

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_TEXT_KEY,
      process.env.AZURE_SPEECH_TEXT_REGION
    );

    speechConfig.speechRecognitionLanguage = "en-US";

    const pushStream = sdk.AudioInputStream.createPushStream();

    pushStream.write(audioBuffer);
    pushStream.close();

    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizeOnceAsync(result => {

      if (result.reason === sdk.ResultReason.RecognizedSpeech) {

        resolve(result.text);

      } else if (result.reason === sdk.ResultReason.NoMatch) {

        reject("No speech recognized");

      } else {

        reject(result.errorDetails);

      }

      recognizer.close();

    }, err => {

      recognizer.close();
      reject(err);

    });

  });

}

module.exports = { speechToText };