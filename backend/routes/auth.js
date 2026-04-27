const express = require("express");
const bcrypt = require("bcryptjs");
const { randomUUID: uuidv4 } = require("crypto");
const { signToken } = require("../middleware/auth");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// File-based user store
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
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  const users = loadUsers();

  if (users[email])
    return res.status(400).json({ message: "Email already in use" });

  if (password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters" });

  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();

  users[email] = { id, name, email, password: hashed, createdAt: new Date() };
  saveUsers(users);

  const token = signToken({ id, name, email });
  res.json({ token, user: { id, name, email } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "All fields are required" });

  const users = loadUsers();
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