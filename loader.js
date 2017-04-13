/* jshint node: true */
'use strict';
const config = require('./knexfile');
let env = 'development';

const fs = require('fs');
const readLine = require('readline');
const Promise = require('bluebird');
const db = require('knex')(config[env]);
const moment = require('moment');
// file locations
const csvLocsFile = 'court_locations.csv';
const csvDataFile = 'cjs-output.csv';
const unlDataFile = 'cjs-output.unl';

const unlReader = readLine.createInterface({
  input: fs.createReadStream(unlDataFile),
});

let csvReader;

// globals
let courtLocationsTable;
let relevantAccounts = [];
let failedInserts = [];

// util
const titleCase = words => {
  if (!words) return '';

  return words
    .split(' ')
    .map(ea => {
      return ea[0] + ea.slice(1).toLowerCase();
    })
    .join(' ');
};

// get in reference table
fs.readFile(csvLocsFile, 'utf8', (err, data) => {
  if (err) {
    throw err;
  } else {
    data = data.split('\r\n').map(ea => {
      return ea.split(',');
    });
    courtLocationsTable = {};
    data.forEach(ea => {
      let name = titleCase(ea[1]);

      if (name == 'Salt Lake District') {
        name += ' (Matheson Courthouse 450 South State St)';
      } else if (name == 'Salt Lake City Justice') {
        name += ' (333 S 200 E)';
      } else if (name == 'Salt Lake County Justice') {
        name += ' (2100 South State St)';
      } else if (name == 'South Jordan Justice') {
        name += ' (1600 West Towne Center Drive)';
      } else if (name == 'West Valley Justice') {
        name += ' (3590 S 2700 W)';
      } else if (name == 'Midvale Justice') {
        name += ' (7505 S Holden St)';
      } else if (name == 'West Jordan Justice') {
        name += ' (8040 South Redwood Road)';
      } else if (name == 'Layton District') {
        name += ' (425 N. Wasatch)';
      }

      courtLocationsTable[ea[0]] = name;
    });
  }
});

unlReader
  .on('line', line => {
    line = line.split('|');

    // ignore line length of 1, as these are empty arrays
    // if line is length 30, then the length is of a result with no court date
    // only lines of length 35 have a court date
    if (!isNaN(line[0]) && line.length == 36) {
      relevantAccounts.push(line);
    } else {
      // cannot use this line
    }
  })
  .on('close', () => {
    // get a list of IDs of relevant users from the parsed list
    relevantAccounts = relevantAccounts.map(ea => {
      return ea[0];
    });

    // now let's look at the csv version instead because it has different
    // data returned this is a result of the way the data is sent to us, it's
    // roundabout but it works
    csvReader = readLine.createInterface({
      input: fs.createReadStream(csvDataFile),
    });

    // run the next matching function
    csvMatch(relevantAccounts);
  });

const csvMatch = accounts => {
  // accounts is a list of IDs
  csvReader
    .on('line', line => {
      line = line.split(',');
      let index = accounts.indexOf(line[0]);

      // make sure that this is actually a result from the previous UNL parsing
      // saved client rows
      if (index > -1) {
        // data in the csv gets jumbled but the last 5 columns always seem
        // to come out clean (here's to hoping this is a reasonable assumption)
        let courtInfo = line.slice(-5);

        // overwrite the value at that point with an object or null if
        // not good data
        if (
          courtInfo[0] &&
          courtInfo[1] &&
          courtInfo[2] &&
          courtInfo[3] &&
          courtInfo[4]
        ) {
          // trim 0s off the front of the location id
          let locationID = courtInfo[3].replace(/^0+/, '');
          accounts[index] = {
            clientId: Number(accounts[index]),
            date: courtInfo[0],
            time: courtInfo[1],
            room: courtInfo[2],
            location: courtLocationsTable[locationID],
            judge: titleCase(courtInfo[4]),
          };
        } else {
          accounts[index] = null;
        }
      } else {
        // do nothing, does not matter b/c not in accounts list
      }
    })
    .on('close', () => {
      accounts = accounts.filter(ea => {
        // ignore null indices and...
        if (ea) {
          // only include dates scheduled within a week from today
          // assuming date format in csv matches this pattern: MM/DD/YYYY
          let afterToday = moment(ea.date, 'MM/DD/YYYY') > moment();
          let onlyWithinSevenDays = moment(ea.date, 'MM/DD/YYYY') <
            moment().add(8, 'days');
          return afterToday && onlyWithinSevenDays;
        } else {
          return false;
        }
      });

      craftNotifications(accounts);
    });
};

const craftNotifications = appointments => {
  appointments = appointments.map(ea => {
    ea.message = `Automated alert: Your next court date is at ` +
      `${ea.location} on ${ea.date}, ${ea.time}, in Rm ${ea.room}. ` +
      `Please text with any questions.`;
    return ea;
  });

  validateNotifications(appointments);
};

const validateNotifications = notifications => {
  let clientIds = notifications.map(ea => {
    return ea.clientId;
  });

  // query by client id and see
  // 1. if user allows automated notifications
  // 2. if client allows automated notifications
  db('clients')
    .select('clients.*')
    .leftJoin('cms', 'clients.cm', 'cms.cmid')
    .whereIn('clients.clid', clientIds)
    .and.where('cms.allow_automated_notifications', true)
    .then(clients => {
      let allowedClients = clients
        .filter(ea => {
          // make sure each client allows for autonotifications
          return ea.allow_automated_notifications;
        })
        .map(ea => {
          return ea.clid;
        });

      let allowedMessages = notifications.filter(ea => {
        return allowedClients.indexOf(ea.clientId) > -1;
      });

      if (allowedMessages.length > 0) {
        queueNotifications(allowedMessages);
      }
    })
    .catch(err => {
      console.log('ERROR: on client left join with cms: ' + err);
    });
};

const queueNotifications = newNotifications => {
  newNotifications.forEach(ea => {
    db('clients')
      .where('clid', ea.clientId)
      .limit(1)
      .then(clients => {
        if (clients.length === 0) {
          console.log(
            `ERROR: A client with id ${ea.clientId} could not be found.`
          );
          failedInserts.push(ea);
        } else {
          let client = clients[0];

          // does the client already have a matching court date
          // notification in the queue?
          let foundIdenticalNotification = false;
          db('notifications')
            .where('client', client.clid)
            .and.where('send', '>', moment())
            .and.where('message', 'ilike', 'automated alert%')
            .then(automatedNotifications => {
              for (let i = 0; i < automatedNotifications.length; i++) {
                let checkNotification = automatedNotifications[i];
                if (checkNotification.message == ea.message) {
                  foundIdenticalNotification = true;
                  break;
                }
              }

              // if we found a match, or if there are already scheduled
              // notification(s), don't insert a new notification and
              // warn the person running this command
              if (foundIdenticalNotification) {
                console.log(
                  `WARNING: NO NEW NOTIFICATION CREATED - I found an ` +
                    `existing identical notification for client ` +
                    `${client.clid}: ${ea.message}`
                );
                console.log('------------------------------------------');
              } else if (automatedNotifications.length > 0) {
                console.log(
                  `WARNING: NO NEW NOTIFICATION CREATED - I found ` +
                    `${automatedNotifications.length} existing automated ` +
                    `notification(s) for client ${client.clid}`
                );
                console.log('------------------------------------------');
              } else {
                // It's safe to insert the notification
                insertNotification(client, ea);
              }
            })
            .catch(err => {
              console.log('ERROR: on notification query: ' + err);
            });
        }
      })
      .catch(err => {
        console.log('ERROR: on client query: ' + err);
      });
  });
};

const insertNotification = (client, notification) => {
  db('notifications')
    .insert({
      cm: client.cm,
      client: client.clid,
      comm: null,
      subject: 'Auto-created court date reminder',
      message: notification.message,
      send: moment(notification.date, 'MM/DD/YYYY')
        .subtract(1, 'day')
        .format('YYYY-MM-DD'),
      ovm_id: null,
      repeat: false,
      frequency: null,
      sent: false,
      closed: false,
      repeat_terminus: null,
    })
    .then(() => {
      return db('alerts_feed').insert({
        user: client.cm,
        created_by: null,
        subject: `Auto-notifications created`,
        message: `A court date notification was auto-created for ` +
          `${client.first} ${client.last}. Edit it on their ` +
          `notifications page.`,
        open: true,
        created: db.fn.now(),
      });
    })
    .then(() => {
      console.log(
        `Created notification for ${client.first} ${client.last} -> ` +
          `"${notification.message}"`
      );
      console.log('------------------------------------------');
    })
    .catch(err => {
      console.log('ERROR: on notification create: ' + err);
    });
};
