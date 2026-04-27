const express = require("express");
const bcrypt = require("bcryptjs");
const { randomUUID: uuidv4 } = require("crypto");
const { signToken } = require("../middleware/auth");

const router = express.Router();

// In-memory user store (we'll move to DynamoDB later)
const users = {};

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  if (users[email])
    return res.status(400).json({ message: "Email already in use" });

  if (password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters" });

  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();

  users[email] = { id, name, email, password: hashed, createdAt: new Date() };

  const token = signToken({ id, name, email });
  res.json({ token, user: { id, name, email } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "All fields are required" });

  const user = users[email];
  if (!user)
    return res.status(400).json({ message: "Invalid email or password" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid)
    return res.status(400).json({ message: "Invalid email or password" });

  const token = signToken({ id: user.id, name: user.name, email: user.email });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

module.exports = router;