require('./api/config/mongoDB');
const express = require('express');
const logger = require('morgan');
const helmet = require('helmet');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const bodyParser = require('body-parser');

const routes = require('./api/routes');
const config = require('./api/config');

const app = express();

app.set('secret', config.SECRET);

app.use(logger(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
const origins = process.env.NODE_ENV === 'production' ? ['https://bidblab.com', 'https://www.bidblab.com'] : ['http://localhost:4300', 'http://localhost:4200'];
app.use(
  cors({
    origin: origins,
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
if (process.env.NODE_ENV !== 'production') {
  app.use(
    `/${config.MEDIA_FOLDER}`,
    express.static(path.join(__dirname, config.MEDIA_FOLDER)),
  );
}
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
