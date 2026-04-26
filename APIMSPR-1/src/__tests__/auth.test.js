import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: { query: vi.fn() },
}));

vi.mock("bcryptjs", async () => ({
  default: {
    hash:    vi.fn().mockResolvedValue("$2b$10$hashed"),
    compare: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", async () => ({
  default: {
    sign:   vi.fn().mockReturnValue("mock.jwt.token"),
    verify: vi.fn().mockReturnValue({ id: 1, email: "t@t.com", role: "user" }),
  },
}));

import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import router from "../routes/auth.js";
import { pool } from "../db.js";
import bcrypt from "bcryptjs";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/auth", router);
  return app;
}

// ── POST /auth/register ───────────────────────────────────────────────

describe("POST /auth/register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crée un compte et retourne 201", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // email absent
      .mockResolvedValueOnce({ rows: [{ id: 1, email: "new@test.com", role: "user" }] });

    const res = await request(createApp())
      .post("/auth/register")
      .send({ email: "new@test.com", password: "pass123" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("new@test.com");
    expect(res.body.user.role).toBe("user");
  });

  it("retourne 400 si le mot de passe est absent", async () => {
    const res = await request(createApp())
      .post("/auth/register")
      .send({ email: "test@test.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("retourne 400 si l'email est absent", async () => {
    const res = await request(createApp())
      .post("/auth/register")
      .send({ password: "pass123" });

    expect(res.status).toBe(400);
  });

  it("retourne 409 si l'email est déjà utilisé", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // email existe

    const res = await request(createApp())
      .post("/auth/register")
      .send({ email: "exists@test.com", password: "pass123" });

    expect(res.status).toBe(409);
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────

describe("POST /auth/login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("connecte l'utilisateur et pose un cookie httpOnly", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, email: "user@test.com", role: "user", password_hash: "$2b$10$hashed" }],
      })
      .mockResolvedValueOnce({ rows: [] }); // INSERT session

    bcrypt.compare.mockResolvedValueOnce(true);

    const res = await request(createApp())
      .post("/auth/login")
      .send({ email: "user@test.com", password: "pass123" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("user");
    expect(res.body.email).toBe("user@test.com");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("retourne 401 si le compte n'existe pas", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp())
      .post("/auth/login")
      .send({ email: "ghost@test.com", password: "pass" });

    expect(res.status).toBe(401);
  });

  it("retourne 401 si le mot de passe est incorrect", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: "u@test.com", role: "user", password_hash: "$2b$10$hashed" }],
    });
    bcrypt.compare.mockResolvedValueOnce(false);

    const res = await request(createApp())
      .post("/auth/login")
      .send({ email: "u@test.com", password: "wrongpass" });

    expect(res.status).toBe(401);
  });

  it("retourne 400 si les champs sont manquants", async () => {
    const res = await request(createApp())
      .post("/auth/login")
      .send({ email: "u@test.com" });

    expect(res.status).toBe(400);
  });
});

// ── GET /auth/me ──────────────────────────────────────────────────────

describe("GET /auth/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne les infos du compte + healthId", async () => {
    // authenticate mock: session active
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })     // sessions check
      .mockResolvedValueOnce({ rows: [{ user_id: 999 }] }); // healthId

    const res = await request(createApp())
      .get("/auth/me")
      .set("Cookie", "token=mock.jwt.token");

    expect(res.status).toBe(200);
    expect(res.body.healthId).toBe(999);
    expect(res.body.email).toBe("t@t.com");
  });

  it("retourne healthId null si aucun profil lié", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 42 }] }) // session active
      .mockResolvedValueOnce({ rows: [] });           // pas de profil

    const res = await request(createApp())
      .get("/auth/me")
      .set("Cookie", "token=mock.jwt.token");

    expect(res.status).toBe(200);
    expect(res.body.healthId).toBeNull();
  });
});
