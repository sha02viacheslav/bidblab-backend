const mongoose = require('mongoose');

const followSchema = mongoose.Schema({
	follower: {
		type: mongoose.SchemaTypes.ObjectId,
		ref: 'User',
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: Date,
});

const userSchema = mongoose.Schema({
	firstName: {
		type: String,
		required: true,
		trim: true,
	},
	lastName: {
		type: String,
		required: true,
		trim: true,
	},
	username: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		lowercase: true,
	},
	email: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		lowercase: true,
	},
	aboutme: {
		type: String,
	},
	phone: {
		type: String,
	},
	tags: {
		type: [String],
	},
	birthday: {
		type: String,
		default: Date.now,
	},
	gender: {
		type: String,
		default: 'male',
	},
	physicaladdress: {
		type: String,
	},
	physicalcity: {
		type: String,
	},
	physicalstate: {
		type: String,
	},
	physicalzipcode: {
		type: String,
	},
	shippingaddress: {
		type: String,
	},
	shippingcity: {
		type: String,
	},
	shippingstate: {
		type: String,
	},
	shippingzipcode: {
		type: String,
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
	role: {
		type: String,
		default: "activate",
	},
	follows: [followSchema],
	resetPasswordToken: String,
	resetPasswordTokenExpiry: Date,
	verificationToken: String,
	verificationTokenExpiry: Date,
	verified: {
		type: Boolean,
		default: false,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: Date,
});

if (!userSchema.options.toObject) userSchema.options.toObject = {};

userSchema.options.toObject.transform = (doc, ret) => {
	delete ret.password;
	delete ret.resetPasswordToken;
	delete ret.resetPasswordTokenExpiry;
	delete ret.verificationToken;
	delete ret.verificationTokenExpiry;
	return ret;
};

mongoose.model('User', userSchema);
