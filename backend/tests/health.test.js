const request = require("supertest");
const express = require("express");

const app = express();
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

describe("Health Check", () => {
  it("should return status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("timestamp");
  });
});