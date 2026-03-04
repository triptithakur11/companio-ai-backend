const express = require("express");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();

const { ClientSecretCredential } = require("@azure/identity");

const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID,
  process.env.AZURE_CLIENT_ID,
  process.env.AZURE_CLIENT_SECRET,
);

router.post("/chat", async (req, res) => {
  const { message } = req.body;

  try {
    const tokenResponse = await credential.getToken(
      "https://ai.azure.com/.default",
    );

    const response = await axios.post(
    process.env.AZURE_GOAL_AGENT_ENDPOINT,
      {
        input: [
          {
            role: "user",
            content: message,
          },
        ],
        agent: {
          name: "companio-goal-map",
          version: "2",
          type: "agent_reference",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResponse.token}`,
        },
      },
    );
// console.log(response);
const data = response?.data?.output?.filter((item)=>item?.type==="message");
    res.json(data);
  } catch (error) {
    console.log("ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "Agent failed" });
  }
});

module.exports = router;




