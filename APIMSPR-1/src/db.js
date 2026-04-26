import process from "process";
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

// Force project .env values even if system/user env vars exist.
dotenv.config({ override: true });

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'healthai',
  user: process.env.DB_USER || 'healthai',
  password: process.env.DB_PASSWORD || 'healthai',
});

pool.on('connect', (client) => {
  client.query('SET search_path TO healthai');
});
