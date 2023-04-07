'use strict';

/* Data Access Object (DAO) module for accessing lights data */

const db = require('./db');
const dayjs = require("dayjs");

/** WARNING: 
 * all DB operations must check that the lights belong to the loggedIn user, 
 * thus include a WHERE user=? check !!!
 */ 

/** NOTE
 * return error messages as json object { error: <string> }
 */


// This function retrieves the whole list of lights from the database.
exports.listLights = (user) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM lights WHERE user=?';
      db.all(sql, [user], (err, rows) => {
        if (err) { reject(err); return; }

        const lights = rows.map((e) => {
          const s = Object.assign({}, e, { date: dayjs(e.date) });  // creating a dayjs object for each date
          return s;
        });
        resolve(lights);
      });
    });
};
  
// This function retrieves a light given its id and the associated user id.
exports.getLight = (user, id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM lights WHERE id=? and user=?';
      db.get(sql, [id, user], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (row == undefined) {
          resolve({ error: 'Light not found.' });
        } else {
          const s = Object.assign({}, row, { date: row.date } );  // creating a dayjs object for each date
          resolve(s);
        }
      });
    });
};
  
  
/**
 * This function adds a new light in the database.
 * The light id is added automatically by the DB, and it is returned as this.lastID.
 */
exports.createLight = (s) => {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO lights (value, date, user) VALUES(?, ?, ?)';
      db.run(sql, [s.value, s.date, s.user], function (err) {
        if (err) {
          reject(err);
          return;
        }
        // Returning the newly created object with the DB additional properties to the client.
        resolve(exports.getLight(s.user, this.lastID));
      });
    });
};
  
/*
 * This function updates an existing light given its id and user.
 */
exports.updateLight = (user, id, s) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE lights SET value = ?, date = ? WHERE id = ? and user = ?';
    db.run(sql, [s.value, s.date, id, user], function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(exports.getLight(s.user, id)); 
    });
  });
};


/** 
 * This function deletes an existing light given its id.
 */ 
exports.deleteLight = (user, id) => {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM lights WHERE id = ? and user = ?';
      db.run(sql, [id, user], (err) => {
        if (err) {
          reject(err);
          return;
        } else
          resolve(null);
      });
    });
}
