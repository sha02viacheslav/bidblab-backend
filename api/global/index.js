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
			adminTrash: 16,
			all: 31
		},
		auctionRole: {
			pending: 0,
			process: 1,
			closed: 2,
			sold: 3,
		}
	}
};

module.exports.changeAuctionRole = async () => {
	const auctions = await Auction.find().exec();
	for (var index in auctions) {
		var roleTemp = auctions[index].role;
		// Clear time related bit of auction role.
		auctions[index].role &= ~(1 << module.exports.data().auctionRole.pending);
		auctions[index].role &= ~(1 << module.exports.data().auctionRole.process);
		auctions[index].role &= ~(1 << module.exports.data().auctionRole.closed);
		// Update time related bit of auction role.
		if (auctions[index].starts > new Date()) {
			auctions[index].role |= 1 << module.exports.data().auctionRole.pending;
		} else if (auctions[index].closes > new Date()) {
			auctions[index].role |= 1 << module.exports.data().auctionRole.process;
		} else {
			auctions[index].role |= 1 << module.exports.data().auctionRole.closed;
		}
		if(roleTemp != auctions[index].role) {
			await auctions[index].save();
		}
		
	}
};