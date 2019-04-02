const mongoose = require('mongoose');
const config = require('../config');

const dbUrl = config.MONGO_URI;

// CAPTURE APP TERMINATION / RESTART EVENTS
// To be called when process is restarted or terminated
const gracefulShutdown = () =>
  new Promise((resolve, reject) => {
    mongoose.connection
      .close()
      .then(() => {
        resolve();
      })
      .catch((err) => {
        reject(err);
      });
  });

// For nodemon restarts
process.once('SIGUSR2', () => {
  gracefulShutdown()
    .then(() => {
      console.log('nodemon restart');
      process.kill(process.pid, 'SIGUSR2');
    })
    .catch((err) => {
      console.error(err);
      process.kill(process.pid, 'SIGUSR2');
    });
});

// For app termination
process.on('SIGINT', () => {
  gracefulShutdown()
    .then(() => {
      console.log('App termination (SIGINT)');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(0);
    });
});

// For Heroku app termination
process.on('SIGTERM', () => {
  gracefulShutdown()
    .then(() => {
      console.log('App termination (SIGTERM)');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(0);
    });
});

mongoose.Promise = Promise;
mongoose
  .connect(dbUrl)
  .then(() => {
    console.log('Successfully connected to mongoDB');
  })
  .catch((err) => {
    console.error(err);
    gracefulShutdown()
      .then(() => {
        process.exit(1);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  });

require('../models/user.model');
require('../models/admin.model');
require('../models/question.model');
require('../models/report.model');
require('../models/interest.model');
require('../models/credit.model');
