const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const { Readable } = require("stream");
const path = require("path");
const os = require("os");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function convertToWav(buffer) {
  return new Promise((resolve, reject) => {
    try {
      if (!buffer || buffer.length === 0) {
        return reject("Empty audio buffer");
      }

      const outputPath = path.join(
        os.tmpdir(),
        `audio-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`,
      );

      const inputStream = new Readable();
      inputStream.push(buffer);
      inputStream.push(null);

      ffmpeg(inputStream)
        .audioFrequency(16000)
        .audioChannels(1)
        .format("wav")
        .on("start", (cmd) => {
          // console.log("FFMPEG START:", cmd);
        })
        .on("end", () => {
          setTimeout(() => {
            resolve(outputPath);
          }, 200);
        })
        .on("error", (err) => {
          console.error("FFMPEG ERROR:", err);
          reject(err);
        })
        .save(outputPath);
    } catch (err) {
      console.error("CONVERT ERROR:", err);
      reject(err);
    }
  });
}

module.exports = { convertToWav };