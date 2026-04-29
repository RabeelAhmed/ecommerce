require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function runMigrations() {
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    console.log('Running migrations...');
    await client.query('BEGIN');
    
    for (const file of files) {
        console.log(`Executing ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
    }
    
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
