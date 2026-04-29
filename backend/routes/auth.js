const express = require("express");
const bcrypt = require("bcryptjs");
const { randomUUID: uuidv4 } = require("crypto");
const { signToken } = require("../middleware/auth");
const fs = require("fs");
const path = require("path");
const logger = require("../logger");

const router = express.Router();

const DB_PATH = path.join(__dirname, "../db.json");

function loadUsers() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

router.post("/signup", async (req, res) => {
  let { name, email, password } = req.body;

  // Sanitize inputs
  name = name?.trim();
  email = email?.toLowerCase().trim();
  password = password;

  // Required fields
  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Length limits
  if (name.length > 100) {
    return res.status(400).json({ message: "Name must be under 100 characters" });
  }
  if (email.length > 254) {
    return res.status(400).json({ message: "Email must be under 254 characters" });
  }
  if (password.length > 128) {
    return res.status(400).json({ message: "Password must be under 128 characters" });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address" });
  }

  // Password validation
  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }
  if (!password.trim()) {
    return res.status(400).json({ message: "Password cannot be only spaces" });
  }

  const users = loadUsers();

  if (users[email]) {
    return res.status(400).json({ message: "Email already in use" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();

  users[email] = { id, name, email, password: hashed, createdAt: new Date() };
  saveUsers(users);

  logger.info("user_signup", { userId: id, email });

  const token = signToken({ id, name, email });
  res.json({ token, user: { id, name, email } });
});

router.post("/login", async (req, res) => {
  let { email, password } = req.body;

  // Sanitize inputs
  email = email?.toLowerCase().trim();

  // Required fields
  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address" });
  }

  const users = loadUsers();
  const user = users[email];

  if (!user) {
    return res.status(400).json({ message: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(400).json({ message: "Invalid email or password" });
  }

  logger.info("user_login", { userId: user.id, email });

  const token = signToken({ id: user.id, name: user.name, email: user.email });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

module.exports = router;