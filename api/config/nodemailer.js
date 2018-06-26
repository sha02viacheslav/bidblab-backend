const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');
const htmlToText = require('nodemailer-html-to-text');
const options = require('./index').MAILER;

const sender = nodemailer.createTransport(mg(options));
sender.use('compile', htmlToText.htmlToText());


module.exports = sender;
