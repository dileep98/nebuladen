const request = require("supertest");
const express = require("express");
const authRoutes = require("../routes/auth");

// Create a minimal test app
const app = express();
app.use(express.json());
app.use("/auth", authRoutes);

describe("Auth Routes", () => {
  const testEmail = `test_${Date.now()}@test.com`;
  const testPassword = "password123";
  let authToken;

  describe("POST /auth/signup", () => {
    it("should create a new user and return a token", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({ name: "Test User", email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.email).toBe(testEmail);
      authToken = res.body.token;
    });

    it("should reject duplicate email", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({ name: "Test User", email: testEmail, password: testPassword });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email already in use");
    });

    it("should reject missing fields", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({ email: testEmail });

      expect(res.status).toBe(400);
    });

    it("should reject short password", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({ name: "Test", email: "new@test.com", password: "123" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Password must be at least 8 characters");
    });
  });

  describe("POST /auth/login", () => {
    it("should login with correct credentials", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
    });

    it("should reject wrong password", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: testEmail, password: "wrongpassword" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid email or password");
    });

    it("should reject non-existent email", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "nobody@test.com", password: testPassword });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid email or password");
    });

    it("should reject missing fields on login", async () => {
    const res = await request(app)
        .post("/auth/login")
        .send({ email: testEmail });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("All fields are required");
    });
  });
});