import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  pool: {
    query:   vi.fn(),
    connect: vi.fn(),
  },
}));

import request from "supertest";
import express from "express";
import router from "../routes/activite_quotidienne.js";
import { pool } from "../db.js";

function createApp(role = "admin", healthId = null) {
  const app = express();
  app.use(express.json());
  // Simule authenticate + attachHealthId
  app.use((req, _res, next) => {
    req.user     = { id: 1, email: "t@t.com", role };
    req.healthId = healthId;
    next();
  });
  app.use("/activite_quotidienne", router);
  return app;
}

// ── GET / ─────────────────────────────────────────────────────────────

describe("GET /activite_quotidienne", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne toutes les activités pour un admin", async () => {
    const rows = [{ id_activity: 1, user_id: 100, workout_type: "Running" }];
    pool.query.mockResolvedValueOnce({ rows });

    const res = await request(createApp("admin")).get("/activite_quotidienne");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    // vérifier que la requête n'a pas de paramètre (admin = tous les users)
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("v_intensite_seance"),
      []
    );
  });

  it("retourne [] si l'utilisateur n'a pas de healthId", async () => {
    const res = await request(createApp("user", null)).get("/activite_quotidienne");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("retourne les activités filtrées par healthId pour un user", async () => {
    const rows = [{ id_activity: 5, user_id: 999, workout_type: "Cycling" }];
    pool.query.mockResolvedValueOnce({ rows });

    const res = await request(createApp("user", 999)).get("/activite_quotidienne");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id"),
      [999]
    );
  });

  it("retourne 500 en cas d'erreur DB", async () => {
    pool.query.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(createApp("admin")).get("/activite_quotidienne");

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});

// ── GET /:user_id/:date ───────────────────────────────────────────────

describe("GET /activite_quotidienne/:user_id/:date", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne la séance pour l'utilisateur et la date donnés", async () => {
    const row = { id_activity: 3, user_id: 123, date: "2026-04-26", workout_type: "Running" };
    pool.query.mockResolvedValueOnce({ rows: [row] });

    const res = await request(createApp("admin"))
      .get("/activite_quotidienne/123/2026-04-26");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(row);
  });

  it("retourne null si aucune séance n'est trouvée", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp("admin"))
      .get("/activite_quotidienne/999/2020-01-01");

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ── POST / ────────────────────────────────────────────────────────────

describe("POST /activite_quotidienne", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crée une séance + 4 intensités dans une transaction", async () => {
    const mockActivity = { id_activity: 42, user_id: 123, workout_type: "Running" };
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)                  // BEGIN
        .mockResolvedValueOnce({ rows: [mockActivity] })   // INSERT activite
        .mockResolvedValueOnce(undefined)                  // INSERT VERY_ACTIVE
        .mockResolvedValueOnce(undefined)                  // INSERT MODERATE
        .mockResolvedValueOnce(undefined)                  // INSERT LIGHT
        .mockResolvedValueOnce(undefined)                  // INSERT SEDENTARY
        .mockResolvedValueOnce(undefined),                 // COMMIT
      release: vi.fn(),
    };
    pool.connect.mockResolvedValueOnce(mockClient);

    const res = await request(createApp("admin"))
      .post("/activite_quotidienne")
      .send({
        user_id:                123,
        date:                   "2026-04-26",
        workout_type:           "Running",
        steps:                  10000,
        calories_burned:        500,
        very_active_minutes:    30,
        fairly_active_minutes:  20,
        lightly_active_minutes: 15,
        sedentary_minutes:      120,
      });

    expect(res.status).toBe(201);
    expect(res.body.id_activity).toBe(42);
    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it("effectue un ROLLBACK en cas d'erreur DB", async () => {
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)                      // BEGIN
        .mockRejectedValueOnce(new Error("Contrainte violée")), // INSERT échoue
      release: vi.fn(),
    };
    pool.connect.mockResolvedValueOnce(mockClient);

    const res = await request(createApp("admin"))
      .post("/activite_quotidienne")
      .send({ user_id: 123, date: "2026-04-26", workout_type: "Running" });

    expect(res.status).toBe(500);
    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClient.release).toHaveBeenCalledOnce();
  });
});

// ── DELETE /:id_activity ──────────────────────────────────────────────

describe("DELETE /activite_quotidienne/:id_activity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("supprime la séance et retourne un message de confirmation", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(createApp("admin"))
      .delete("/activite_quotidienne/42");

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE"),
      ["42"]
    );
  });
});