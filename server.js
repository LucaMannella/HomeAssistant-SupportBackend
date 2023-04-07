/*** Importing modules ***/
const express = require('express');
const morgan = require('morgan'); // logging middleware
const cors = require('cors');

const { check, validationResult, body, param } = require('express-validator'); // validation middleware

const temperatureDao = require('./dao-temperatures'); // module for accessing the temperatures table in the DB
const userDao = require('./dao-users'); // module for accessing the users table in the DB
const switchDao = require('./dao-switches'); // module for accessing the switches table in the DB
const lightDao = require('./dao-lights'); // module for accessing the lights table in the DB

/** Authentication-related imports **/
const passport = require('passport');
const LocalStrategy = require('passport-local');
const session = require('express-session');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc)


/*** init express and set-up the middlewares ***/
const app = express();
app.use(morgan('dev'));
app.use(express.json());

/**
 * The "delay" middleware introduces some delay in server responses. To change the delay change the value of "delayTime" (specified in milliseconds).
 * This middleware could be useful for debug purposes, to enabling it uncomment the following lines.
 */ 
// const delayTime = 1000;
// const delay = require('express-delay');
// app.use(delay(delayTime));


/** Set up and enable Cross-Origin Resource Sharing (CORS) **/
const corsOptions = {
  origin: 'http://localhost:3000',
  credentials: true,
};
app.use(cors(corsOptions));


/*** Passport ***/

// Set up local strategy to verify, search in the DB a user with a matching password, and retrieve its information by userDao.getUser (i.e., id, username, name).
passport.use(new LocalStrategy(async function verify(username, password, cb) {
  const user = await userDao.getUser(username, password)
  if(!user)
    return cb(null, false, 'Incorrect username or password');  
    
  return cb(null, user); // NOTE: user info in the session (all fields returned by userDao.getUser, i.e, id, username, name)
}));

// Serializing in the session the user object given from LocalStrategy(verify).
passport.serializeUser(function (user, cb) { // this user is id + username + name 
  cb(null, user);
});

// Starting from the data in the session, we extract the current (logged-in) user.
passport.deserializeUser(function (user, cb) { // this user is id + email + name 
  // if needed, we can do extra check here (e.g., double check that the user is still in the database, etc.)
  // e.g.: return userDao.getUserById(id).then(user => cb(null, user)).catch(err => cb(err, null));

  return cb(null, user); // this will be available in req.user
});

// Creating the session
app.use(session({
  secret: "shhhhh... it's a secret!",
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.authenticate('session'));


/*** Defining authentication verification middleware ***/

const isLoggedIn = (req, res, next) => {
  if(req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({error: 'Not authorized'});
}


/*** Utility Functions ***/

// This function is used to format express-validator errors as strings
const errorFormatter = ({ location, msg, param, value, nestedErrors }) => {
  return `${location}[${param}]: ${msg}`;
};


/*** Users APIs ***/

// POST /api/sessions 
// This route is used for performing login.
app.post('/api/sessions', function(req, res, next) {
  passport.authenticate('local', (err, user, info) => { 
    if (err)
      return next(err);
      if (!user) {
        // display wrong login messages
        return res.status(401).json({error: info});
      }
      // success, perform the login and extablish a login session
      req.login(user, (err) => {
        if (err)
          return next(err);
        
        // req.user contains the authenticated user, we send all the user info back
        // this is coming from userDao.getUser() in LocalStratecy Verify Fn
        return res.json(req.user); // WARN: returns 200 even if .status(200) is missing?
      });
  })(req, res, next);
});


/*
// POST /api/sessions 
// This is an alternative logind route. It performs login without sending back an error message.
app.post('/api/sessions', passport.authenticate('local'), (req, res) => {
  res.status(201).json(req.user);
});
*/

// GET /api/sessions/current
// This route checks whether the user is logged in or not.
app.get('/api/sessions/current', (req, res) => {
  if(req.isAuthenticated()) {
    res.status(200).json(req.user);}
  else
    res.status(401).json({error: 'Not authenticated'});
});

// DELETE /api/session/current
// This route is used for loggin out the current user.
app.delete('/api/sessions/current', (req, res) => {
  req.logout(() => {
    res.status(200).json({});
  });
});


/*** Temperatures APIs ***/

// GET /api/temperatures
// This route returns the TemperatureLibrary.
app.get('/api/temperatures', 
//isLoggedIn,               // check: is the user logged-in?
(req, res) => {
  // NOTE: user exists for sure otherwise isLoggedIn would fail
  // get temperatures that match optional filter in the query
  temperatureDao.listTemperatures(1)
  //temperatureDao.listTemperatures(req.user.id)
    // NOTE: "invalid dates" (i.e., missing dates) are set to null during JSON serialization
    .then(temperatures => res.json(temperatures))
    .catch((err) => res.status(500).json(err)); // always return a json and an error message
});

// GET /api/temperatures/last
// This route returns the last stored temperature.
app.get('/api/temperatures/last', 
// isLoggedIn,                 // check: is the user logged-in?
// [ check('id').isInt() ],    // check: validation
async (req, res) => {
  try {
    const result = await temperatureDao.getLastTemperature(1);
    //const result = await temperatureDao.getTemperature(req.user.id);
    if (result.error)
      res.status(404).json(result);
    else
      // NOTE: "invalid dates" (i.e., missing dates) are set to null during JSON serialization
      res.json(result);
  } catch (err) {
    res.status(500).end();
  }
});

// GET /api/temperatures/<id>
// Given a temperature id, this route returns the associated temperature from the library.
app.get('/api/temperatures/:id', 
// isLoggedIn,                 // check: is the user logged-in?
// [ check('id').isInt() ],    // check: validation
async (req, res) => {
  try {
    const result = await temperatureDao.getTemperature(1, req.params.id);
    // const result = await temperatureDao.getTemperature(req.user.id, req.params.id);
    if (result.error)
      res.status(404).json(result);
    else
      // NOTE: "invalid dates" (i.e., missing dates) are set to null during JSON serialization
      res.json(result);
  } catch (err) {
    res.status(500).end();
  }
});


// POST /api/temperatures
// This route adds a new temperature to temperature library.
app.post('/api/temperatures',
//isLoggedIn,
[
  // only date (first ten chars) and valid ISO
  // check('date').isLength({min: 10, max: 10}).isISO8601({ strict: true }).optional({ checkFalsy: true }).not().isAfter(),
  check('value').isFloat(),
], 
async (req, res) => {
  const errors = validationResult(req).formatWith(errorFormatter); // format error message
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: errors.array().join(", ")  }); // error message is a single string with all error joined together
  }

  // WARN: note that we expect date with capital D but the databases does not care and uses lowercase letters, so it returns "watchdate"

  const temperature = {
    date: dayjs.utc().format(), // A different method is required if also time is present. For instance: (req.body.date || '').split('T')[0]
    value: req.body.value,
    //user: req.user.id  // user is overwritten with the id of the user that is doing the request and it is logged in
    user: 1
  };
  console.log(temperature);

  try {
    const result = await temperatureDao.createTemperature(temperature); // NOTE: createTemperature returns the new created object
    res.json(result); 
  } catch (err) {
    res.status(503).json({ error: `Database error during the creation of new temperature: ${err}` }); 
  }
});


// DELETE /api/temperatures/<id>
// Given a temperature id, this route deletes the associated temperature from the library.
app.delete('/api/temperatures/:id',
// isLoggedIn,
// [ check('id').isInt() ], 
async (req, res) => {
  try {
    // NOTE: if there is no temperature with the specified id, the delete operation is considered successful.
    await temperatureDao.deleteTemperature(1, req.params.id);
    // await temperatureDao.deleteTemperature(req.user.id, req.params.id);
    res.status(200).json({}); 
  } catch (err) {
    res.status(503).json({ error: `Database error during the deletion of temperature ${req.params.id}: ${err} ` });
  }
});


/* ------ */


// GET /api/switches/<id>
// Given a switch id, this route returns the switch's status.
app.get('/api/switches/:id', 
// isLoggedIn,                 // check: is the user logged-in?
// [ check('id').isInt() ],    // check: validation
async (req, res) => {
    try {
      const result = await switchDao.getSwitch(1, req.params.id);
      if (result.error)
        res.status(404).json(result);
      else
        // NOTE: "invalid dates" (i.e., missing dates) are set to null during JSON serialization
        res.json(result);
    } catch (err) {
      res.status(500).end();
    }
});

// PUT /api/switches/<id>
// This route changes the status of a switch. It could also be a PATCH.
app.put('/api/switches/:id/', 
//isLoggedIn,
  [
    check(['id']).isInt(),
    check('value').isBoolean(),
  ], 
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter); // format error message
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(", ")  }); // error message is a single string with all error joined together
    }

    if (req.body.id !== Number(req.params.id)) {  // Check if url and body id mismatch
      return res.status(422).json({ error: 'URL and body id mismatch' });
    }

  try {
    // const s = await switchDao.getSwitch(req.user.id, req.params.id);
    const s = await switchDao.getSwitch(req.body.user, req.body.id);
    if (s.error)
      return res.status(404).json(s);
    
    s.date = dayjs.utc().format();
    s.value =  req.body.value;
    console.log(s);
    
    // const result = await switchDao.updateSwitch(req.user.id, s.id, s);
    const result = await switchDao.updateSwitch(req.body.user, s.id, s);
    return res.json(result); 
  } catch (err) {
    res.status(503).json({ error: `Database error during the update of switch ${req.params.id}` });
  }
});


// GET /api/lights/<id>
// Given a light id, this route returns the light's status.
app.get('/api/lights/:id',
// isLoggedIn,                 // check: is the user logged-in?
// [ check('id').isInt() ],    // check: validation
async (req, res) => {
    try {
      const result = await lightDao.getLight(1, req.params.id);
      if (result.error)
        res.status(404).json(result);
      else
        // NOTE: "invalid dates" (i.e., missing dates) are set to null during JSON serialization
        res.json(result);
    } catch (err) {
      res.status(500).end();
    }
});

// PUT /api/lights/<id>
// This route changes the status of a light. It could also be a PATCH.
app.put('/api/lights/:id/',
//isLoggedIn,
  [
    check(['id']).isInt(),
    check('value').isInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter); // format error message
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(", ")  }); // error message is a single string with all error joined together
    }

    if (req.body.id !== Number(req.params.id)) {  // Check if url and body id mismatch
      return res.status(422).json({ error: 'URL and body id mismatch' });
    }

  try {
    const s = await lightDao.getLight(req.body.user, req.body.id);
    if (s.error)
      return res.status(404).json(s);

    s.date = dayjs.utc().format();
    s.value =  req.body.value;
    console.log(s);

    const result = await lightDao.updateLight(req.body.user, s.id, s);
    return res.json(result);
  } catch (err) {
    res.status(503).json({ error: `Database error during the update of light ${req.params.id}` });
  }
});


// Activating the server
const PORT = 3001;
app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}/`));
