const mongoose = require('mongoose');

const bidSchema = mongoose.Schema({
    bider: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User',
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
    auctioner: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User',
    },
    productName: {
        type: String,
    },
    productDescription: {
        type: String,
    },
    manufactureDescription: {
        type: String,
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
    auctionId: {
        type: Number,
        default: 0
    },
    closes: {
        type: Date,
        default: Date.now,
    },
    bids: [bidSchema],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: Date,
    auctionPicture: {
        type: String,
    },
});

mongoose.model('Auction', auctionSchema);
