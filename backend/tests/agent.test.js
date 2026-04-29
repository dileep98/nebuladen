const { verifyToken, signToken } = require("../middleware/auth");
const express = require("express");
const request = require("supertest");

describe("Auth Middleware", () => {
  it("should sign and verify a token", () => {
    const payload = { id: "123", name: "Test", email: "test@test.com" };
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.name).toBe(payload.name);
  });

  it("should reject an invalid token", () => {
    expect(() => verifyToken("invalid.token.here")).toThrow();
  });

  it("should reject an expired token", () => {
    const jwt = require("jsonwebtoken");
    const expiredToken = jwt.sign(
      { id: "123" },
      "nebuladen-super-secret-jwt-key-2026",
      { expiresIn: "0s" }
    );
    expect(() => verifyToken(expiredToken)).toThrow();
  });

  it("should work as Express middleware with valid token", async () => {
    const payload = { id: "123", name: "Test", email: "test@test.com" };
    const token = signToken(payload);

    const app = express();
    app.use(express.json());
    app.get("/protected", (req, res, next) => verifyToken(req, res, next), (req, res) => {
      res.json({ user: req.user });
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe("123");
  });

  it("should reject middleware request with no token", async () => {
    const app = express();
    app.use(express.json());
    app.get("/protected", (req, res, next) => verifyToken(req, res, next), (req, res) => {
      res.json({ user: req.user });
    });

    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
  });

  it("should reject middleware request with invalid token", async () => {
    const app = express();
    app.use(express.json());
    app.get("/protected", (req, res, next) => verifyToken(req, res, next), (req, res) => {
      res.json({ user: req.user });
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid.token");

    expect(res.status).toBe(401);
  });
});