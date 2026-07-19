const path = require('path');

const shared = {
  client: 'pg',
  migrations: {
    directory: path.join(__dirname, 'src', 'migrations'),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.join(__dirname, 'src', 'seeds'),
  },
};

function connection(defaultDatabase) {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'archisynapse',
    password: process.env.DB_PASSWORD || 'archisynapse',
    database: process.env.DB_NAME || defaultDatabase,
  };
}

module.exports = {
  development: {
    ...shared,
    connection: connection('archisynapse_dev'),
  },
  test: {
    ...shared,
    connection: connection('archisynapse_test'),
    pool: { min: 0, max: 5 },
  },
  production: {
    ...shared,
    connection: connection('archisynapse'),
    pool: { min: 2, max: 10 },
  },
};
