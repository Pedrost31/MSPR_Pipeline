import process from "process";
import pkg from "pg";
const { Pool } = pkg;
import "dotenv/config";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', (client) => {
  client.query('SET search_path TO healthai');
});
