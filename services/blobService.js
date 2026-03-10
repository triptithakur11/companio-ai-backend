const { BlobServiceClient } = require("@azure/storage-blob");
require("dotenv").config();

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING,
);

async function uploadToBlob(file, containerName, blobPath) {
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // ensure container exists
  await containerClient.createIfNotExists();

  const safeName = file.originalname.replace(/\s+/g, "-");

  const blobName = blobPath ? blobPath : `${Date.now()}-${safeName}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype,
    },
  });

  return blockBlobClient.url;
}

module.exports = {
  uploadToBlob,
};
