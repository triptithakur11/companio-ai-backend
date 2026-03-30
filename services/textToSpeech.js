const sdk = require("microsoft-cognitiveservices-speech-sdk");
require("dotenv").config();
const { franc } = require("franc");
const { hinglishWords, languageVoiceMap } = require("../constants");

function escapeXML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isHinglish(text) {
  const lower = text.toLowerCase();
  return hinglishWords.some((word) => lower.includes(word));
}

async function textToSpeech(
  text,
  voiceSettings = {
    voice: "male",
    style: "assistant",
    speed: 1.05,
    pitch: 2,
    styleDegree: 1.35,
  },
) {
  return new Promise((resolve, reject) => {
    try {
      const speechConfig = sdk.SpeechConfig.fromSubscription(
        process.env.AZURE_TEXT_SPEECH_KEY,
        process.env.AZURE_TEXT_SPEECH_REGION,
      );

      const isHindiScript = /[\u0900-\u097F]/.test(text);
      const hinglish = isHinglish(text);

      let langCode;

      if (isHindiScript || hinglish) {
        langCode = "hin";
      } else {
        const detected = franc(text || "", { minLength: 3 });
        langCode = detected === "und" ? "eng" : detected;
      }

      const langConfig = languageVoiceMap[langCode] || languageVoiceMap.eng;
      const voice = langConfig[voiceSettings.voice] || langConfig.female;
      speechConfig.speechSynthesisVoiceName = voice;

      const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

      const rate = `${Math.round((voiceSettings.speed - 1) * 100)}%`;
      const pitch = `${voiceSettings.pitch || 0}%`;

      const allowedStyles = [
        "friendly",
        "cheerful",
        "sad",
        "angry",
        "calm",
        "assistant",
        "excited",
      ];

      const style = allowedStyles.includes(voiceSettings.style)
        ? voiceSettings.style
        : "friendly";

      const styleDegree = voiceSettings.styleDegree || 1.3;

      const cleanText = escapeXML(text);

      function enhanceTextForSpeech(text) {
        return text
          .replace(/\. /g, ". <break time='500ms'/> ")
          .replace(/\? /g, "? <break time='400ms'/> ")
          .replace(/! /g, "! <break time='400ms'/> ")
          .replace(/, /g, ", <break time='200ms'/> ")
          .replace(
            /\b(important|focus|remember|note)\b/gi,
            "<emphasis level='strong'>$1</emphasis>",
          )
          .replace(
            /\b(wow|amazing|great|awesome)\b/gi,
            "<emphasis level='moderate'>$1</emphasis>",
          );
      }

      const processedText = enhanceTextForSpeech(cleanText);

      const ssml = `
        <speak version="1.0" xml:lang="${langConfig.lang}"
          xmlns="http://www.w3.org/2001/10/synthesis"
          xmlns:mstts="http://www.w3.org/2001/mstts">

          <voice name="${voice}">
            <mstts:express-as style="${style}" styledegree="${styleDegree}">
              <prosody rate="${rate}" pitch="${pitch}">
                ${processedText}
              </prosody>
            </mstts:express-as>
          </voice>

        </speak>
      `;

      synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve(Buffer.from(result.audioData));
          } else {
            console.error("TTS ERROR:", result);
            reject(result.errorDetails);
          }
          synthesizer.close();
        },
        (err) => {
          console.error("TTS FAIL:", err);
          reject(err);
        },
      );
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { textToSpeech };