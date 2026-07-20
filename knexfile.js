// Knex configuration for Archisynapse
// - development/test: better-sqlite3 (zero-setup local database)
// - production: PostgreSQL via DATABASE_URL
require('dotenv').config();

const path = require('path');

const sqliteBase = {
  client: 'better-sqlite3',
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, 'src', 'migrations'),
  },
  seeds: {
    directory: path.join(__dirname, 'src', 'seeds'),
  },
};

module.exports = {
  development: {
    ...sqliteBase,
    connection: {
      filename: process.env.SQLITE_PATH || path.join(__dirname, 'data', 'archisynapse.dev.db'),
    },
    pool: {
      afterCreate: (conn, done) => done(null, conn),
    },
  },

  test: {
    ...sqliteBase,
    connection: {
      // A fresh database file per test suite: Jest resets the module
      // registry between suites, so this module re-evaluates and each
      // suite gets its own isolated SQLite file (no cross-suite
      // interference from shared triggers, seeds, or unique constraints).
      filename: path.join(
        require('os').tmpdir(),
        `archisynapse.test.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.db`,
      ),
    },
    // A single connection per suite: SQLite triggers + multiple pooled
    // connections are racy under parallel Jest load, and one connection
    // is faster for SQLite anyway.
    pool: { min: 1, max: 1 },
  },

  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: parseInt(process.env.DATABASE_POOL_SIZE, 10) || 20,
    },
    migrations: {
      directory: path.join(__dirname, 'src', 'migrations'),
    },
  },
};
