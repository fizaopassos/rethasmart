const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rethasmart',
  password: 'LinuxBR951',
  port: 5432,
});

module.exports = pool;
