const mongoose = require('mongoose');

const adminSchema = mongoose.Schema({
	username: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		lowercase: true,
	},
	email: {
		type: String,
		unique: true,
		trim: true,
		lowercase: true,
	},
	password: {
		type: String,
		required: true,
		trim: true,
	},
	profilePicture: {
		url: String,
		path: String,
	},
	resetPasswordToken: String,
	resetPasswordTokenExpiry: Date,
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: Date,
});

if (!adminSchema.options.toObject) adminSchema.options.toObject = {};

adminSchema.options.toObject.transform = (doc, ret) => {
	delete ret.password;
	delete ret.resetPasswordToken;
	delete ret.resetPasswordTokenExpiry;
	return ret;
};

mongoose.model('Admin', adminSchema);
