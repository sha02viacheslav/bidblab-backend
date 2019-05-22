const mongoose = require('mongoose');
const joi = require('joi');
const moment = require('moment');
const path = require('path');
const Validations = require('../utils/validations');
const Encryption = require('../utils/encryption');
const config = require('../config');
const global = require('../global');
const fs = require('fs-extra');

const User = mongoose.model('User');
const Question = mongoose.model('Question');
const Credit = mongoose.model('Credit');
const Interest = mongoose.model('Interest');
const Report = mongoose.model('Report');
const Auction = mongoose.model('Auction');
const Mail = mongoose.model('Mail');
const Sitemanager = mongoose.model('Sitemanager');
const Invite = mongoose.model('Invite');

const ObjectId = mongoose.Types.ObjectId;
module.exports.data = () => {
  return data = {
    mailRole: {
      inbox: 1,
      sent: 2,
      archived: 4,
      trash: 8,
      all: 15
    },
    auctionRole: {
      pending: 1,
      process: 2,
      closed: 4,
      deleted: 8,
      all: 15
    }
  }
};

module.exports.changeAuctionRole = async () => {
  const auctions = await Auction.find().exec();
  for(var index in auctions) {
    if(auctions[index].starts > new Date()){
      auctions[index].role = module.exports.data().auctionRole.pending;
    }
    else if(auctions[index].closes > new Date()){
      auctions[index].role = module.exports.data().auctionRole.process;
    }
    else{
      auctions[index].role = module.exports.data().auctionRole.closed;
    }
    await auctions[index].save();
  }
};