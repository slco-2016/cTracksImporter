/* jshint node: true */
"use strict";
const config = require("./knexfile");
let env = "development";

const Promise = require("bluebird");
const fs = require("fs");
const csv = require("csv");
const readLine = require("readline");
const db = require("knex")(config[env]);
const moment = require("moment");

const csvDataFile = "client-profile-updates.csv";

// read the data into an object
let records = [];
let stream = fs
  .createReadStream(__dirname + `/${csvDataFile}`)
  .pipe(csv.parse({ columns: true, delimiter: "," }))
  .on("data", function(record) {
    records.push(record);
  })
  .on("end", function() {
    processClients(records);
  });

// process the clients
const processClients = clients => {
  clients.forEach(ea => {
    db("clients").where("clid", ea.clid).limit(1).then(clients => {
      if (clients.length === 0) {
        console.log(`ERROR: A client with clid ${ea.clid} was not found.`);
      } else {
        let client = clients[0];
        let dob = moment(ea.Cdob, "MM/DD/YY");
        let cdob = moment(dob).format("MM/DD/YY");
        let ddob = moment(client.dob).format("MM/DD/YY");
        let valid = true;
        let invalidReasons = [];
        let needsUpdate = false;
        console.log(`============ processing client ${ea.clid} ============`);
        if (String(ea.cm) !== String(client.cm)) {
          valid = false;
          invalidReasons.push(
            `case manager doesn't match (${ea.cm} != ${client.cm})`
          );
        }
        if (cdob !== ddob) {
          needsUpdate = true;
          console.log(`> will change dob to ${cdob} from ${ddob}`);
        }
        if (ea["Ctrack#"] !== client.otn) {
          needsUpdate = true;
          console.log(
            `> will change otn to ${ea["Ctrack#"]} from ${client.otn}`
          );
        }
        if (valid && needsUpdate) {
          performUpdate(ea.clid, cdob, ea["Ctrack#"]);
        } else if (!valid) {
          console.log(
            `WARNING: Didn't update client ${ea.clid} ` +
              `because ${invalidReasons.join(", ")}`
          );
        }
        console.log(``);
      }
    });
  });
};

const logUpdate = (clientId, dob, ctrackNumber) => {
  console.log(
    `$$$$$$$$$$$ will update client ${clientId} $$$$$$$$$$$`
  );
};

const performUpdate = (clientId, dob, ctrackNumber) => {
  db("clients")
    .where("clid", clientId)
    .update({ dob: dob, otn: ctrackNumber })
    .then(success => {
      if (success) {
        console.log(
          `$$$$$$$$$$$ updated client ${clientId} $$$$$$$$$$$`
        );
      } else {
        console.log(`ERROR: Failed to update client ${clientId}.`);
      }
    });
};
