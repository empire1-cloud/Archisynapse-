const knex = require('knex');
const config = require('../knexfile');

const requestedEnv = process.env.NODE_ENV || 'development';
const env = Object.prototype.hasOwnProperty.call(config, requestedEnv)
  ? requestedEnv
  : 'development';
const db = knex(config[env]);

module.exports = db;
