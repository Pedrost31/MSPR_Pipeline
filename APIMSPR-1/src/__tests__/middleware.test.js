import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: { query: vi.fn() },
}));

vi.mock("jsonwebtoken", async () => ({
  default: { verify: vi.fn() },
}));

import { authenticate, authorizeWrite, authorizeRole } from "../middleware/auth.js";
import { pool } from "../db.js";
import jwt from "jsonwebtoken";

function mockReqResNext(overrides = {}) {
  const req = { cookies: {}, headers: {}, user: null, token: null, ...overrides };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  return { req, res, next };
}

// ── authenticate ──────────────────────────────────────────────────────

describe("authenticate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appelle next() et attache req.user avec un token valide", async () => {
    const { req, res, next } = mockReqResNext({ cookies: { token: "valid.jwt" } });
    jwt.verify.mockReturnValue({ id: 1, email: "test@test.com", role: "user" });
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ id: 1, email: "test@test.com", role: "user" });
    expect(req.token).toBe("valid.jwt");
  });

  it("retourne 401 quand aucun token n'est fourni", async () => {
    const { req, res, next } = mockReqResNext();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepte le token depuis le header Authorization: Bearer", async () => {
    const { req, res, next } = mockReqResNext({
      headers: { authorization: "Bearer header.jwt.token" },
    });
    jwt.verify.mockReturnValue({ id: 2, email: "h@test.com", role: "admin" });
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.token).toBe("header.jwt.token");
  });

  it("retourne 401 quand la session est expirée ou révoquée", async () => {
    const { req, res, next } = mockReqResNext({ cookies: { token: "expired.jwt" } });
    jwt.verify.mockReturnValue({ id: 1, email: "test@test.com", role: "user" });
    pool.query.mockResolvedValue({ rows: [] }); // session introuvable

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("retourne 403 quand le token JWT est invalide", async () => {
    const { req, res, next } = mockReqResNext({ cookies: { token: "bad.token" } });
    jwt.verify.mockImplementation(() => { throw new Error("invalid signature"); });

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── authorizeWrite ────────────────────────────────────────────────────

describe("authorizeWrite", () => {
  it("laisse passer un admin sur POST", () => {
    const { req, res, next } = mockReqResNext({ method: "POST", user: { role: "admin" } });
    authorizeWrite(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("laisse passer un admin sur DELETE", () => {
    const { req, res, next } = mockReqResNext({ method: "DELETE", user: { role: "admin" } });
    authorizeWrite(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("bloque un user sur POST avec 403", () => {
    const { req, res, next } = mockReqResNext({ method: "POST", user: { role: "user" } });
    authorizeWrite(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("bloque un user sur PUT avec 403", () => {
    const { req, res, next } = mockReqResNext({ method: "PUT", user: { role: "user" } });
    authorizeWrite(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("laisse passer un user sur GET", () => {
    const { req, res, next } = mockReqResNext({ method: "GET", user: { role: "user" } });
    authorizeWrite(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ── authorizeRole ─────────────────────────────────────────────────────

describe("authorizeRole", () => {
  it("laisse passer le bon rôle", () => {
    const { req, res, next } = mockReqResNext({ user: { role: "admin" } });
    authorizeRole("admin")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("bloque un rôle incorrect avec 403", () => {
    const { req, res, next } = mockReqResNext({ user: { role: "user" } });
    authorizeRole("admin")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
