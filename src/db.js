const knex = require('knex');
const config = require('../knexfile');
const env = ['production', 'test'].includes(process.env.NODE_ENV)
  ? process.env.NODE_ENV
  : 'development';
const db = knex(config[env]);

module.exports = db;
