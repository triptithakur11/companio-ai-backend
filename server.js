const express = require("express");
const cors = require("cors");
const chatRoutes = require("./routes/chat");
const authRoutes = require("./routes/auth");
const goalsRoutes = require("./routes/goals");
const revisionRoutes = require("./routes/smartRev");
const userRoutes = require("./routes/user");
const { connectDB } = require("./db/db");
const app = express();
require("dotenv").config();
connectDB();

app.use(cors());
app.use(express.json());
app.use("/chat", chatRoutes);
app.use("/auth", authRoutes);
app.use("/goals", goalsRoutes);
app.use("/revision", revisionRoutes);
app.use("/user", userRoutes);

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Companio API is running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});