const mongoose = require('mongoose');

const recieverSchema = mongoose.Schema({
	reciever: {
		type: mongoose.SchemaTypes.ObjectId,
		ref: 'User',
	},
	role: {
		type: Number,
		default: 0,
	},
});

const mailSchema = mongoose.Schema({
	sender: {
		type: mongoose.SchemaTypes.ObjectId,
		ref: 'User',
	},
	recievers: [recieverSchema],
	subject: {
		type: String,
		trim: true,
	},
	message: {
		type: String,
		trim: true,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	role: {
		type: Number,
		default: 0,
	},
});

mongoose.model('Mail', mailSchema);
