require('./api/config/mongoDB');
const express = require('express');
const logger = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const bodyParser = require('body-parser');
const path = require('path');

const routes = require('./api/routes');
const config = require('./api/config');

const app = express();

app.set('secret', config.SECRET);

app.use(logger(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(
  cors({
    origin: ['https://bidblab.com', 'https://www.bidblab.com'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  }),
);
app.use(helmet());
app.use(compression());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  }),
);
app.use(
  `/${config.MEDIA_FOLDER}`,
  express.static(path.join(__dirname, `${config.MEDIA_FOLDER}`)),
);
app.use('/api', routes);

// 500 internal server error handler
app.use((err, req, res, next) => {
  res.status(500).json({
    // Never leak the stack trace of the err if running in production mode
    err: process.env.NODE_ENV === 'production' ? null : err,
    msg: '500 Internal Server Error',
    data: null,
  });
});

// 404 error handler
app.use((req, res) => {
  res.status(404).json({
    err: null,
    msg: '404 Not Found',
    data: null,
  });
});

module.exports = app;
