const axios = require("axios");

async function translateText(text, targetLang) {
  try {
    const response = await axios.post(
      `https://companio-new-resource.cognitiveservices.azure.com/translator/text/v3.0/translate?api-version=3.0&to=${targetLang}`,
      [{ text }],
      {
        headers: {
          "Ocp-Apim-Subscription-Key": process.env.AZURE_DOC_TRANSLATOR_KEY,
          "Ocp-Apim-Subscription-Region": process.env.AZURE_DOC_TRANSLATOR_REGION,
          "Content-Type": "application/json",
        },
      }
    );

    const translated =
      response.data[0].translations[0].text;

    return translated;

  } catch (error) {
    console.log("TRANSLATION ERROR:", error.response?.data || error.message);
    throw new Error("Translation failed");
  }
}

module.exports = { translateText };