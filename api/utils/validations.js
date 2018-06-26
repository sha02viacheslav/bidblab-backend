const mongoose = require('mongoose');
const moment = require('moment');

module.exports.isString = str => typeof str === 'string';

module.exports.isNumber = num => !Number.isNaN(num);

module.exports.isBoolean = bool =>
  bool === true || bool === false || toString.call(bool) === '[object Boolean]';

module.exports.isDate = date => moment.isDate(date) || moment(date).isValid();

module.exports.isObject = obj => typeof obj === 'object';

module.exports.isArray = arr => Array.isArray(arr);

module.exports.isObjectId = id => mongoose.Types.ObjectId.isValid(id);

module.exports.matchesRegex = (str, regex) => regex.test(str);
