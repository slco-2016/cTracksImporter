const colors = require('colors');

// Environment is set with the CCENV process environment variable
// This can be set in the command line before commands 
// (e.g. CCENV=development npm start)
const CCENV = process.env.CCENV || 'development';

const baseProductionReadyCredentials = {

  // Allow access to CCENV be consistent from credentials.js
  // TODO: Update all references to CCENV to be from here
  CCENV: CCENV,

  // Connection details for the production database
  db: {
    user:     'xxxx',
    password: 'xxxx',
    host:     'xxxx',
    port:     5432
  },

};

// Changes made when we are developing (e.g. staging server, different rootURL, etc.)
if (CCENV == 'development') {
  baseProductionReadyCredentials.db.host = 'xxxx';
}

const hostName = baseProductionReadyCredentials.db.host;
console.log(`Database being used: ${hostName}`.yellow);

module.exports = baseProductionReadyCredentials;
