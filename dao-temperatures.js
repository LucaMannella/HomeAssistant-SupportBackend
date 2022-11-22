'use strict';

/* Data Access Object (DAO) module for accessing temperatures data */

const db = require('./db');
const dayjs = require("dayjs");

/** WARNING: 
 * all DB operations must check that the temperatures belong to the loggedIn user, 
 * thus include a WHERE user=? check !!!
 */ 

/** NOTE
 * return error messages as json object { error: <string> }
 */


// This function retrieves the whole list of temperatures from the database.
exports.listTemperatures = (user, filter) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM temperatures WHERE user=?';
      db.all(sql, [user], (err, rows) => {
        if (err) { reject(err); return; }

        const temperatures = rows.map((e) => {
          // WARN: the database returns only lowercase fields. So, to be compliant with the client-side, we convert "date" to the camelCase version ("date").
          const temperature = Object.assign({}, e, { date: dayjs(e.date) });  // adding camelcase "date"
          // delete temperature.date;  // removing lowercase "date"
          return temperature;
        });
        resolve(temperatures);
      });
    });
};
  
// This function retrieves a temperature given its id and the associated user id.
exports.getTemperature = (user, id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM temperatures WHERE id=? and user=?';
      db.get(sql, [id, user], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (row == undefined) {
          resolve({ error: 'Temperature not found.' });
        } else {
          // WARN: database is case insensitive. Converting "date" to camel case format
          const temperature = Object.assign({}, row, { date: row.date } );  // adding camelcase "date"
          // delete temperature.date;  // removing lowercase "date"
          resolve(temperature);
        }
      });
    });
};


/*
 * This function retrieves the last temperature of a given user id.
 */
exports.getLastTemperature = (user) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM temperatures WHERE user=? ORDER BY date DESC LIMIT 1;';
    db.get(sql, [user], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (row == undefined) {
        console.log("sono qui");
        resolve({ error: 'There is no temperature for this sensor!' });
      } else {
        // WARN: database is case insensitive. Converting "date" to camel case format
        const temperature = Object.assign({}, row, { date: row.date } );  // adding camelcase "date"
        // delete temperature.date;  // removing lowercase "date"
        resolve(temperature);
      }
    });
  });
};
  
  
/**
 * This function adds a new temperature in the database.
 * The temperature id is added automatically by the DB, and it is returned as this.lastID.
 */
exports.createTemperature = (temperature) => {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO temperatures (date, value, user) VALUES(?, ?, ?)';
      db.run(sql, [temperature.date, temperature.value, temperature.user], function (err) {
        if (err) {
          reject(err);
          return;
        }
        // Returning the newly created object with the DB additional properties to the client.
        resolve(exports.getTemperature(temperature.user, this.lastID));
      });
    });
};
  

/** 
 * This function deletes an existing temperature given its id.
 */ 
exports.deleteTemperature = (user, id) => {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM temperatures WHERE id = ? and user = ?';
      db.run(sql, [id, user], (err) => {
        if (err) {
          reject(err);
          return;
        } else
          resolve(null);
      });
    });
}
