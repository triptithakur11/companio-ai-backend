const bcrypt = require("bcrypt");
const express = require("express");
const sql = require("mssql");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await sql.query`
    INSERT INTO Users (name, email, passwordHash)
    VALUES (${name}, ${email}, ${hash})
  `;

  res.json({ message: "User created" });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await sql.query`
    SELECT * FROM Users WHERE email=${email}
  `;

  if (result.recordset.length === 0)
    return res.status(400).json({ error: "User not found" });

  const user = result.recordset[0];

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) return res.status(400).json({ error: "Wrong password" });

  const token = jwt.sign(
  { id: user.id },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

  res.json({ token });
});

module.exports = router;
