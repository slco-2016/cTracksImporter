// Update with your config settings.
var credentialsDB = require("./credentials").db;
var USER = credentialsDB.user;
var PASS = credentialsDB.password;
var HOST = credentialsDB.host;
var PORT = credentialsDB.port;
var localDbUser = credentialsDB.localDbUser;

module.exports = {


  testing: {
    client: "postgresql",
    connection: {
      user: localDbUser,
      database: "cctest"
    }
  },

  // Development and host are now the same, they just reference different Amazong RDS PG instances
  development: {
    client: "postgresql",
    connection: {
      host: HOST,
      port: PORT,
      database: "clientcomm",
      user:     USER,
      password: PASS
    },

    pool: {
      min: 2,
      max: 10
    },

    migrations: {
      tableName: "knex_migrations"
    },
  },

  production: {
    client: "postgresql",
    connection: {
      host: HOST,
      port: PORT,
      database: "clientcomm",
      user:     USER,
      password: PASS
    },

    pool: {
      min: 2,
      max: 10
    },

    migrations: {
      tableName: "knex_migrations"
    },
  }

};
