const mongoose = require('mongoose');

const bidSchema = mongoose.Schema({
    bidder: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User',
    },
    clientIp: {
        type: String,
        default: ''
    },
    bidPrice: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

const auctionSchema = mongoose.Schema({
    auctionTitle: {
        type: String,
        required: true,
        trim: true,
    },
    bidblabPrice: {
        type: Number,
        default: 0
    },
    retailPrice: {
        type: Number,
        default: 0
    },
    bidFee: {
        type: Number,
        default: 0
    },
    auctionSerial: {
        type: Number,
        default: 0
    },
    auctionDetail: {
        type: String,
        default: '',
    },
    starts: {
        type: Date,
        default: Date.now,
    },
    closes: {
        type: Date,
        default: Date.now,
    },
    role: {
      type: Number,
      default: 0,
    },
    bids: [bidSchema],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: Date,
    auctionPicture: {
        type: [String],
        default: [],
    },
});

mongoose.model('Auction', auctionSchema);
