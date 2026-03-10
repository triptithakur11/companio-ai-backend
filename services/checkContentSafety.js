const axios = require("axios");
const { extractText } = require("./documentService"); 
const { speechToText } = require("./speechToText"); 

require("dotenv").config();

const endpoint = process.env.AZURE_SAFETY_ENDPOINT;
const key = process.env.AZURE_SAFETY_KEY;

async function analyzeText(text) {

  const url =
    `${endpoint}/contentsafety/text:analyze?api-version=2023-10-01`;

  const response = await axios.post(
    url,
    {
      text,
      categories: ["Hate", "Sexual", "Violence", "SelfHarm"]
    },
    {
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

async function analyzeImage(imageUrl) {

  const url =
    `${endpoint}/contentsafety/image:analyze?api-version=2023-10-01`;

  const response = await axios.post(
    url,
    {
      image: { url: imageUrl }
    },
    {
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

async function checkSafety({ text, file, voice, imageUrl }) {

  let contentToCheck = text;

  if (file && file.buffer) {
    contentToCheck = await extractText(file.buffer);
  }

  if (voice && voice.buffer) {
    contentToCheck = await speechToText(voice.buffer);
  }

  if (imageUrl) {
    return await analyzeImage(imageUrl);
  }

  if (contentToCheck) {
    return await analyzeText(contentToCheck);
  }

  return null;
}

module.exports = { checkSafety };