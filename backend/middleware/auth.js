const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "nebuladen-secret-key";

function verifyToken(req, res, next) {
  // If called as middleware
  if (req && res && next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: "No token provided" });
    const token = header.split(" ")[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ message: "Invalid token" });
    }
  } else {
    // If called directly with a token string (for WebSocket)
    const token = req;
    return jwt.verify(token, JWT_SECRET);
  }
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

module.exports = { verifyToken, signToken };