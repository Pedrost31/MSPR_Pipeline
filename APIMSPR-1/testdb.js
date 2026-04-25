/* global console */
import { pool } from "./src/db.js";

const test = async () => {
  try {
    const res = await pool.query("SELECT * FROM healthai.api_users WHERE role = 'admin'");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  }
};

test();