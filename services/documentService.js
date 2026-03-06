const {
  DocumentAnalysisClient,
  AzureKeyCredential,
} = require("@azure/ai-form-recognizer");

require("dotenv").config();

const docClient = new DocumentAnalysisClient(
  process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_DOC_INTELLIGENCE_KEY)
);

async function extractText(fileBuffer) {
  const poller = await docClient.beginAnalyzeDocument(
    "prebuilt-document",
    fileBuffer
  );

  const result = await poller.pollUntilDone();

  let fullText = "";

  for (const page of result.pages) {
    for (const line of page.lines) {
      fullText += line.content + "\n";
    }
  }

  return fullText;
}

module.exports = {
  extractText
};