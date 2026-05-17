const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15,                        // 4 cluster workers * 15 = 60 < 100 (PG max_connections)
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
});

module.exports = pool;
