/* global console */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import 'dotenv/config';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = process.argv[2] ?? path.join(__dirname, '../../../Downloads/merged.csv');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = [];
    let cur = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { values.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

const num = v => (v === '' || v === null || v === undefined) ? null : Number(v);
const int = v => (v === '' || v === null || v === undefined) ? null : Math.round(Number(v));
const str = v => (v === '' || v === null || v === undefined) ? null : String(v).trim();

async function run() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(raw);
  console.log(`Parsed ${rows.length} rows from CSV`);

  // Alter columns that have text values in the CSV but are integer in the DB
  await pool.query(`
    ALTER TABLE healthai.utilisateur
      ALTER COLUMN age TYPE varchar(20),
      ALTER COLUMN bmi_range TYPE varchar(50)
  `).catch(() => {});

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert unique users
    const seenIds = new Set();
    let userCount = 0;
    for (const row of rows) {
      if (seenIds.has(row.Id)) continue;
      seenIds.add(row.Id);

      await client.query(
        `INSERT INTO healthai.utilisateur
           (id, age, gender, objective, dietary_constraint,
            target_calories_daily, preferred_exercise_type, fitness_level, bmi_range)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [
          num(row.Id),
          str(row.AGE),
          str(row.GENDER),
          str(row.objective),
          str(row.dietary_constraint),
          int(row.target_calories_daily),
          str(row.preferred_exercise_type),
          str(row.fitness_level),
          str(row.BMI_RANGE),
        ]
      );
      userCount++;
    }
    console.log(`Inserted ${userCount} utilisateurs`);

    // 2. Insert activity rows
    let actCount = 0;
    for (const row of rows) {
      await client.query(
        `INSERT INTO healthai.activite_quotidienne
           (id, activity_date, total_steps, total_distance, tracker_distance,
            very_active_distance, moderately_active_distance, light_active_distance,
            very_active_minutes, fairly_active_minutes, lightly_active_minutes,
            sedentary_minutes, calories, activity_score, intense_activity_ratio,
            sedentary_ratio_pct, total_active_minutes, steps_7d_avg,
            activity_trend, health_score, goal_progress_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (id, activity_date) DO NOTHING`,
        [
          num(row.Id),
          str(row.ActivityDate),
          int(row.TotalSteps),
          num(row.TotalDistance),
          num(row.TrackerDistance),
          num(row.VeryActiveDistance),
          num(row.ModeratelyActiveDistance),
          num(row.LightActiveDistance),
          int(row.VeryActiveMinutes),
          int(row.FairlyActiveMinutes),
          int(row.LightlyActiveMinutes),
          int(row.SedentaryMinutes),
          int(row.Calories),
          int(row.activity_score),
          num(row.intense_activity_ratio),
          num(row.sedentary_ratio_pct),
          int(row.total_active_minutes),
          int(row.steps_7d_avg),
          str(row.activity_trend),
          num(row.health_score),
          num(row.goal_progress_pct),
        ]
      );
      actCount++;
    }
    console.log(`Inserted ${actCount} activites_quotidiennes`);

    // 3. Insert sleep rows (only if sleep data present)
    let sleepCount = 0;
    for (const row of rows) {
      if (!row.TotalMinutesAsleep || row.TotalMinutesAsleep === '') continue;
      await client.query(
        `INSERT INTO healthai.sommeil
           (id, activity_date, total_minutes_asleep, total_minutes,
            sleep_efficiency_pct, sleep_hours, sleep_quality)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id, activity_date) DO NOTHING`,
        [
          num(row.Id),
          str(row.ActivityDate),
          int(row.TotalMinutesAsleep),
          int(row.total_minutes),
          num(row.sleep_efficiency_pct),
          int(row.sleep_hours),   // lowercase sleep_hours (float) rounded to int
          str(row.sleep_quality),
        ]
      );
      sleepCount++;
    }
    console.log(`Inserted ${sleepCount} sommeil records`);

    // 4. Insert wellbeing rows
    let bienCount = 0;
    for (const row of rows) {
      await client.query(
        `INSERT INTO healthai.bien_etre
           (id, activity_date, fruits_veggies, daily_stress, places_visited,
            core_circle, supporting_others, social_network, achievement,
            donation, todo_completed, flow, daily_steps, live_vision,
            sleep_hours, lost_vacation, daily_shouting, sufficient_income,
            personal_awards, time_for_passion, weekly_meditation,
            work_life_balance_score, wellbeing_score, social_score,
            productivity_score, stress_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
         ON CONFLICT (id, activity_date) DO NOTHING`,
        [
          num(row.Id),
          str(row.ActivityDate),
          int(row.FRUITS_VEGGIES),
          int(row.DAILY_STRESS),
          int(row.PLACES_VISITED),
          int(row.CORE_CIRCLE),
          int(row.SUPPORTING_OTHERS),
          int(row.SOCIAL_NETWORK),
          int(row.ACHIEVEMENT),
          int(row.DONATION),
          int(row.TODO_COMPLETED),
          int(row.FLOW),
          int(row.DAILY_STEPS),
          int(row.LIVE_VISION),
          int(row.SLEEP_HOURS),   // uppercase SLEEP_HOURS (integer wellbeing column)
          int(row.LOST_VACATION),
          int(row.DAILY_SHOUTING),
          int(row.SUFFICIENT_INCOME),
          int(row.PERSONAL_AWARDS),
          int(row.TIME_FOR_PASSION),
          int(row.WEEKLY_MEDITATION),
          num(row.WORK_LIFE_BALANCE_SCORE),
          num(row.wellbeing_score),
          num(row.social_score),
          num(row.productivity_score),
          str(row.stress_level),
        ]
      );
      bienCount++;
    }
    console.log(`Inserted ${bienCount} bien_etre records`);

    await client.query('COMMIT');
    console.log('Import complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
