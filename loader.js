'use strict';
const config = require('./knexfile');
let env = 'development';

const fs = require('fs');
const readLine = require('readline');
const Promise = require('bluebird');
const db = require('knex')(config[env]);
const moment = require('moment');

const unlReader = readLine.createInterface({
  input: fs.createReadStream('data.unl')
});

let csvReader;

// globals
let courtLocationsTable;
let relevantAccounts = [];
let failedInserts = [];

// util
const correctCase = (words) => {
  if (!words) return '';

  return words.split(' ').map((ea) => {
    return ea[0] + ea.slice(1).toLowerCase();
  }).join(' ');
};

// get in reference table
fs.readFile('court_locations.csv', 'utf8', (err, data) => {
  if (err) {
    throw err;
  } else {
    data = data.split('\r\n').map((ea) => {
      return ea.split(',');
    });
    courtLocationsTable = {};
    data.forEach((ea) => {
      let name = correctCase(ea[1]);

      if (name == 'Salt Lake District') {
        name += ' (Matheson Courthouse 450 South State St) ';
      } else if (name == 'Salt Lake City Justice') {
        name += ' (333 S 200 E) ';
      } else if (name == 'Salt Lake County Justice') {
        // TODO: What is address for this location?
      } else if (name == 'South Jordan Justice') {
        name += ' (8080 S Redwood Rd. Ste. 1701) ';
      } else if (name == 'West Valley Justice') {
        name += ' (1600 West Towne Center Drive) ';
      } else if (name == 'Midvale Justice') {
        name += ' 7505 S. Holden St ';
      } else if (name == 'West Jordan Justice') {
        name += ' (8040 South Redwood Road) ';
      }

      courtLocationsTable[ea[0]] = name;
    });
  }
});

unlReader.on('line', (line) => {
  line = line.split('|');

  // ignore line length of 1, as these are empty arrays
  // if line is length 30, then the length is of a result with no court date
  // only lines of length 35 have a court date
  if (!isNaN(line[0]) && line.length == 35) {
    relevantAccounts.push(line);
  }
}).on('close', () => {
  relevantAccounts = relevantAccounts.map((ea) => {
    return ea[0];
  });
  csvReader = readLine.createInterface({
    input: fs.createReadStream('data.csv')
  });
  csvMatch(relevantAccounts);
});

const csvMatch = (accounts) => {
  // now switch over to the csv since the unl data is missing court locations
  csvReader.on('line', (line) => {
    line = line.split(',');
    let index = accounts.indexOf(line[0]);
    if (index > -1) {
      let courtInfo = line.slice(-5);
      if (courtInfo[0] && courtInfo[1] && courtInfo[2] && courtInfo[3] && courtInfo[4]) {
        accounts[index] = {
          clientId: Number(accounts[index]),
          date: courtInfo[0],
          time: courtInfo[1],
          room: courtInfo[2],
          location: courtLocationsTable[courtInfo[3]],
          judge: correctCase(courtInfo[4]),
        }
      } else {
        accounts[index] = null;
      }
    }
  }).on('close', () => {
    accounts = accounts.filter((ea) => {
      return ea;
    });

    craftMessages(accounts);
  });
};

const craftMessages = (appointments) => {
  appointments = appointments.map((ea) => {
    ea.message = `Your next court date is at ${ea.location} on ${ea.date} at ${ea.time}, in Room ${ea.room}. Text me with any questions.`;
    return ea;
  });

  insertMessages(appointments)
};

const insertMessages = (messages) => {
  messages.forEach((ea) => {
    db('clients')
      .where('clid', ea.clientId)
      .limit(1)
    .then((clients) => {
      if (clients.length == 0) {
        failedInserts.push(ea)
      } else {
        let client = clients[0];

        // console.log(ea.date)
        // console.log(moment(new Date(ea.date)).subtract(2, 'day').format('YYYY-MM-DD'))
        // console.log('------------------------------------------------------------------')
        
        db('notifications')
          .insert({
            cm: client.cm,
            client: client.clid,
            comm: null,
            subject: 'Auto-created court date reminder',
            message: ea.message,
            send: moment(ea.date).subtract(2, 'day').format('YYYY-MM-DD'),
            ovm_id: null,
            repeat: false,
            frequency: null,
            sent: false,
            closed: false,
            repeat_terminus: null,
          })
        .then(() => {
          return db('alerts_feed')
            .insert({
              user: client.cm,
              created_by: null,
              subject: `Auto-notifications created `,
              message: `A court date notification was auto-created for ${client.first} ${client.last}. Edit it on their notifications page.`,
              open: true,
              created: db.fn.now(),
            });
        }).then(() => {
          console.log('One client done (' + client.first + ' ' + client.last + ').');
        }).catch((err) => {
          console.log('Error on notification create: ' + err);
        });
      }
    }).catch((err) => {
      console.log('Error on client query: ' + err);
    })
  });
}