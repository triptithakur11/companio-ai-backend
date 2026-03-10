const ffmpeg = require("fluent-ffmpeg");
const { Readable } = require("stream");
const path = require("path");

async function convertToWav(buffer) {

  const inputStream = new Readable();
  inputStream.push(buffer);
  inputStream.push(null);

  const outputPath = path.join(__dirname, `temp-${Date.now()}.wav`);

  return new Promise((resolve, reject) => {

    ffmpeg(inputStream)
      .audioFrequency(16000)
      .audioChannels(1)
      .format("wav")
      .save(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject);

  });

}

module.exports = { convertToWav };