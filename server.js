const express = require("express");
const cors = require("cors");


require("dotenv").config();

const { connectDB } = require("./db/db");

connectDB();


const agentRoutes = require("./routes/agent");
const chatRoutes = require("./routes/chat");
const authRoutes = require("./routes/auth");
const goalsRoutes = require("./routes/goals");
const notesRoute = require("./routes/notes");
const revisionRoutes = require("./routes/smartRev");
const app = express();


app.use(cors());
app.use(express.json());
app.use("/agent", agentRoutes);
app.use("/chat", chatRoutes);
app.use("/auth", authRoutes);
app.use("/goals", goalsRoutes);
app.use("/notes", notesRoute);
app.use("/revision", revisionRoutes);


app.listen(3000, () => {
  console.log("Server running on port 3000");
});