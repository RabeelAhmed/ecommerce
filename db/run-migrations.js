require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function runMigrations() {
  const client = await pool.connect();
  try {
    const migrationPath = path.join(__dirname, 'migrations', '001_initial.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migrations...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migrations executed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error executing migrations:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
