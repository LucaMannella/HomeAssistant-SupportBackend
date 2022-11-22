'use strict';

/* Data Access Object (DAO) module for accessing switches data */

const db = require('./db');
const dayjs = require("dayjs");

/** WARNING: 
 * all DB operations must check that the switches belong to the loggedIn user, 
 * thus include a WHERE user=? check !!!
 */ 

/** NOTE
 * return error messages as json object { error: <string> }
 */


// This function retrieves the whole list of switches from the database.
exports.listSwitches = (user) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM switches WHERE user=?';
      db.all(sql, [user], (err, rows) => {
        if (err) { reject(err); return; }

        const switches = rows.map((e) => {
          const s = Object.assign({}, e, { date: dayjs(e.date) });  // creating a dayjs object for each date
          return s;
        });
        resolve(switches);
      });
    });
};
  
// This function retrieves a switch given its id and the associated user id.
exports.getSwitch = (user, id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM switches WHERE id=? and user=?';
      db.get(sql, [id, user], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (row == undefined) {
          resolve({ error: 'Switch not found.' });
        } else {
          const s = Object.assign({}, row, { date: row.date } );  // creating a dayjs object for each date
          resolve(s);
        }
      });
    });
};
  
  
/**
 * This function adds a new switch in the database.
 * The switche id is added automatically by the DB, and it is returned as this.lastID.
 */
exports.createSwitch = (s) => {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO switches (date, value, user) VALUES(?, ?, ?)';
      db.run(sql, [s.date, s.value, s.user], function (err) {
        if (err) {
          reject(err);
          return;
        }
        // Returning the newly created object with the DB additional properties to the client.
        resolve(exports.getSwitch(s.user, this.lastID));
      });
    });
};
  
/*
 * This function updates an existing switch given its id and user.
 */
exports.updateSwitch = (user, id, s) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE switches SET date = ?, value = ? WHERE id = ? and user = ?';
    db.run(sql, [s.date, s.value, id, user], function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(exports.getSwitch(s.user, id)); 
    });
  });
};


/** 
 * This function deletes an existing switch given its id.
 */ 
exports.deleteSwitch = (user, id) => {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM switches WHERE id = ? and user = ?';
      db.run(sql, [id, user], (err) => {
        if (err) {
          reject(err);
          return;
        } else
          resolve(null);
      });
    });
}
