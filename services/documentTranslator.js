const FormData = require("form-data");
const axios = require("axios");

async function translateDocument(file, targetLang) {
  const endpoint = process.env.AZURE_DOC_TRANSLATOR_ENDPOINT;
  const key = process.env.AZURE_DOC_TRANSLATOR_KEY;

  const url = `${endpoint}/translator/document:translate`;

  const formData = new FormData();

  formData.append("document", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const config = {
    method: "post",
    url: url,
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      ...formData.getHeaders(),
    },
    params: {
      "api-version": "2024-05-01",
      targetLanguage: targetLang,
    },
    data: formData,
    responseType: "arraybuffer",
  };

  const response = await axios(config);

  return response.data;
}

module.exports = { translateDocument };
