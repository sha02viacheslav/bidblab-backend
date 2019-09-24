const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const joi = require('joi');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const rand = require('rand-token');
const nodemailer = require('../config/nodemailer');
const Encryption = require('../utils/encryption');
const Validations = require('../utils/validations');
const config = require('../config');

const User = mongoose.model('User');
const Admin = mongoose.model('Admin');
const Invite = mongoose.model('Invite');

module.exports.signup = async (req, res) => {
	const schema = joi
		.object({
			firstName: joi
				.string()
				.trim()
				.required(),
			lastName: joi
				.string()
				.trim()
				.required(),
			birthday: joi
				.date(),
			username: joi
				.string()
				.trim()
				.lowercase()
				.alphanum()
				.min(3)
				.max(30)
				.required(),
			email: joi
				.string()
				.trim()
				.lowercase()
				.email()
				.required(),
			password: joi
				.string()
				.trim()
				.min(8)
				.required(),
			confirmPassword: joi
				.string()
				.trim()
				.equal(req.body.password)
				.required(),
		})
		.options({
			stripUnknown: true,
		});
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(422).json({
			msg: result.error.details[0].message,
			err: null,
			data: null,
		});
	}
	const user = await User.findOne({
		$or: [
			{
				username: result.value.username,
			},
			{
				email: result.value.email,
			},
		],
	})
		.lean()
		.exec();
	if (user) {
		return res.status(422).json({
			err: null,
			msg: 'Username or Email already exists, please choose another.',
			data: null,
		});
	}
	result.value.password = await Encryption.hashPassword(result.value.password);
	result.value.verificationToken = rand.generate(32);
	result.value.verificationTokenExpiry = moment()
		.add(24, 'hours')
		.toDate();
	const newUser = await User.create(result.value);

	// nodemailer.sendMail({
	//   from: config.MAILER.from,
	//   to: newUser.email,
	//   subject: 'Account Verification',
	//   html: `<p>Hello ${
	//     newUser.username
	//   }, please click on the following link to verify your account: <a href="${
	//     config.FRONTEND_URI
	//   }/gateway/verifyAccount/${result.value.verificationToken}">Verify</a></p>`,
	// });


	// const mailgun = require("mailgun-js");
	// const DOMAIN = 'sandbox9a8adc4ce55f49f0b77eb0b22c554c10.mailgun.org';
	// const mg = new mailgun({apiKey: '4ec4f2bb04b25807208f073fd21e9511-985b58f4-83a89e91', domain: DOMAIN});
	const mailgun = require("mailgun-js");
	const DOMAIN = 'verify.bidblab.com';
	const mg = new mailgun({ apiKey: '1c483f030a25d74004bd2083d3f42585-b892f62e-b1b60d12', domain: DOMAIN });


	const data = {
		from: 'Bidblab <support@bidblab.com>',
		to: newUser.email,
		subject: 'Account Verification',
		html: `<p>Hello ${
			newUser.username
			}, please click on the following link to verify your account: <a href="${
			config.FRONTEND_URI
			}/gateway/verifyAccount/${result.value.verificationToken}">Verify</a></p>`,
	};
	mg.messages().send(data);


	// nodemailer.sendMail({
	//   from: config.MAILER.from,
	//   to: req.body.email,
	//   subject: 'Account Verification',
	//   html: `<p>Hello ${
	//     newUser.username
	//   }, please click on the following link to verify your account: <a href="${
	//     config.FRONTEND_URI
	//   }/#/verifyAccount/${result.value.verificationToken}">Verify</a></p>`,
	// }, function (err, info) {
	//   if (err) {
	//     console.log('Error: ' + err);
	//   }
	//   else {
	//     console.log('Response: ' + info);
	//   }
	// });

	res.status(201).json({
		err: null,
		msg: `Welcome, ${newUser.username}, your registration was successful.`,
		data: {
			user: newUser
		},
	});
};

module.exports.userLogin = async (req, res) => {
	const schema = joi
		.object({
			username: joi
				.string()
				.trim()
				.lowercase()
				.required(),
			password: joi
				.string()
				.trim()
				.required(),
		})
		.options({ stripUnknown: true });
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(422).json({
			err: null,
			msg: result.error.details[0].message,
			data: null,
		});
	}
	const user = await User.findOne({
		username: result.value.username,
	}).exec();
	if (!user) {
		return res
			.status(404)
			.json({ err: null, msg: 'Account not found.', data: null });
	}
	if (!user.verified) {
		return res
			.status(404)
			.json({ err: null, msg: 'Account not verified.', data: null });
	}
	const passwordMatches = await Encryption.comparePasswordToHash(
		result.value.password,
		user.password,
	);
	if (!passwordMatches) {
		return res
			.status(401)
			.json({ err: null, msg: 'Password is incorrect.', data: null });
	}
	const token = jwt.sign(
		{
			user: user.toObject(),
		},
		config.SECRET,
		{
			expiresIn: '24h',
		},
	);
	res.status(200).json({
		err: null,
		msg: `Welcome, ${user.username}.`,
		data: token,
	});
};

module.exports.adminLogin = async (req, res) => {
	const schema = joi
		.object({
			username: joi
				.string()
				.trim()
				.lowercase()
				.required(),
			password: joi
				.string()
				.trim()
				.required(),
		})
		.options({ stripUnknown: true });
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(422).json({
			err: null,
			msg: result.error.details[0].message,
			data: null,
		});
	}
	const admin = await Admin.findOne({
		username: result.value.username,
	}).exec();
	if (!admin) {
		return res
			.status(404)
			.json({ err: null, msg: 'Account not found.', data: null });
	}
	const passwordMatches = await Encryption.comparePasswordToHash(
		result.value.password,
		admin.password,
	);
	if (!passwordMatches) {
		return res
			.status(401)
			.json({ err: null, msg: 'Password is incorrect.', data: null });
	}
	const token = jwt.sign(
		{
			user: admin.toObject(),
			admin: true,
		},
		config.SECRET,
		{
			expiresIn: '24h',
		},
	);
	res.status(200).json({
		err: null,
		msg: `Welcome, ${admin.username}.`,
		data: token,
	});
};

module.exports.verifyAccount = async (req, res) => {
	let user = await User.findOne({
		verificationToken: req.params.verificationToken,
		verified: true
	}).exec();
	if(user) {
		user.verificationToken = undefined;
	} else {
		user = await User.findOne({
			verificationToken: req.params.verificationToken,
			verificationTokenExpiry: {
				$gt: moment().toDate(),
			},
		}).exec();
		if (!user) {
			return res.status(200).json({
				err: null,
				msg: 'Verification token is invalid or has expired, you can resend the verification email and try again.',
				data: null,
			});
		}

		const invite = await Invite.findOne({ friendEmail: user.email }).exec();
		if (invite) {
			invite.success = true;
			await invite.save();
		}

		user.verificationTokenExpiry = undefined;
		user.verified = true;
	}
	await user.save();

	const token = jwt.sign(
		{
			user: user.toObject(),
		},
		config.SECRET,
		{
			expiresIn: '24h',
		},
	);

	res.status(200).json({
		err: null,
		msg: `Welcome, ${user.username}.`,
		data: token,
	});
};

module.exports.forgotPassword = async (req, res) => {
	const schema = joi
		.object({
			email: joi
				.string()
				.trim()
				.lowercase()
				.email()
				.required(),
		})
		.options({ stripUnknown: true });
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(422).json({
			err: null,
			msg: result.error.details[0].message,
			data: null,
		});
	}
	const user = await User.findOne({
		email: result.value.email,
	}).exec();
	if (!user) {
		return res.status(404).json({
			err: null,
			msg: 'Email is not associated with any existing account.',
			data: null,
		});
	}
	user.resetPasswordToken = rand.generate(32);
	user.resetPasswordTokenExpiry = moment()
		.add(24, 'hours')
		.toDate();
	await user.save();
	// await nodemailer.sendMail({
	//   from: config.MAILER.from,
	//   to: user.email,
	//   subject: 'Password Reset',
	//   html: `<p>Hello ${
	//     user.username
	//   }, please click on the following link to reset your account's password: <a href="${
	//     config.FRONTEND_URI
	//   }/#/resetPassword/${
	//     user.resetPasswordToken
	//   }">Reset</a><br> If you did not make the request, then ignore this email, your account will be safe.</p>`,
	// });

	const mailgun = require("mailgun-js");
	const DOMAIN = 'verify.bidblab.com';
	const mg = new mailgun({ apiKey: '1c483f030a25d74004bd2083d3f42585-b892f62e-b1b60d12', domain: DOMAIN });

	const data = {
		from: 'Bidblab <support@bidblab.com>',
		to: user.email,
		subject: 'Password Reset',
		html: `<p>Hello ${
			user.username
			}, please click on the following link to reset your account's password: <a href="${
			config.FRONTEND_URI
			}/gateway/resetPassword/${
			user.resetPasswordToken
			}">Reset</a><br> If you did not make the request, then ignore this email, your account will be safe.</p>`,
	};
	mg.messages().send(data);

	res.status(200).json({
		err: null,
		msg:
			'An email with further instructions on how to reset your password was sent to you, check your inbox!',
		data: null,
	});
};

module.exports.checkResetPasswordToken = async (req, res) => {
	const user = await User.findOne({
		resetPasswordToken: req.params.resetPasswordToken,
		resetPasswordTokenExpiry: {
			$gt: moment().toDate(),
		},
	})
		.lean()
		.exec();
	if (!user) {
		return res.status(422).json({
			err: null,
			msg:
				'Reset password token is invalid or has expired, you can submit a forgot password request again.',
			data: null,
		});
	}
	res.status(200).json({
		err: null,
		msg: 'You can now reset your password.',
		data: user._id,
	});
};

module.exports.resetPassword = async (req, res) => {
	if (!Validations.isObjectId(req.params.userId)) {
		return res.status(422).json({
			err: null,
			msg: 'userId parameter must be a valid ObjectId.',
			data: null,
		});
	}
	const schema = joi
		.object({
			password: joi
				.string()
				.trim()
				.required()
				.min(8),
			confirmPassword: joi
				.string()
				.trim()
				.required()
				.equal(req.body.password),
		})
		.options({ stripUnknown: true });
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(422).json({
			err: null,
			msg: result.error.details[0].message,
			data: null,
		});
	}
	const user = await User.findOne({
		_id: req.params.userId,
		resetPasswordToken: req.params.resetPasswordToken,
		resetPasswordTokenExpiry: {
			$gt: moment().toDate(),
		},
	}).exec();
	if (!user) {
		return res
			.status(404)
			.json({ err: null, msg: 'Account not found.', data: null });
	}
	user.password = await Encryption.hashPassword(result.value.password);
	user.resetPasswordToken = undefined;
	user.resetPasswordTokenExpiry = undefined;
	await user.save();
	res
		.status(200)
		.json({ err: null, msg: 'Password was reset successfully.', data: null });
};

module.exports.changePassword = async (req, res) => {
	const schema = joi
		.object({
			currentPassword: joi
				.string()
				.trim()
				.required(),
			password: joi
				.string()
				.trim()
				.required()
				.min(8),
			confirmPassword: joi
				.string()
				.trim()
				.required()
				.equal(req.body.password),
		})
		.options({ stripUnknown: true });
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(422).json({
			err: null,
			msg: result.error.details[0].message,
			data: null,
		});
	}
	const user = await User.findById(req.decodedToken.user._id).exec();
	if (!user) {
		return res
			.status(404)
			.json({ err: null, msg: 'Account not found.', data: null });
	}
	const passwordMatches = await Encryption.comparePasswordToHash(
		result.value.currentPassword,
		user.password,
	);
	if (!passwordMatches) {
		return res
			.status(403)
			.json({ err: null, msg: 'Current password is incorrect.', data: null });
	}
	user.password = await Encryption.hashPassword(result.value.password);
	await user.save();
	res
		.status(200)
		.json({ err: null, msg: 'Password was changed successfully.', data: null });
};

module.exports.updateProfile = async (req, res) => {
	const schema = joi
		.object({
			firstName: joi
				.string()
				.trim()
				.required(),
			lastName: joi
				.string()
				.trim()
				.required(),
			username: joi
				.string()
				.trim()
				.lowercase()
				.alphanum()
				.min(3)
				.max(30)
				.required(),
			email: joi
				.string()
				.trim()
				.lowercase()
				.email()
				.required(),
			birthday: joi
				.date()
				.required(),
			tags: joi
				.array()
				.items(
					joi.string()
				),
		})
		.options({
			stripUnknown: true,
		});
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(422).json({
			msg: result.error.details[0].message,
			err: null,
			data: null,
		});
	}
	if (result.value.username || result.value.email) {
		const user = await User.findOne({
			_id: {
				$ne: req.decodedToken.user._id,
			},
			$or: [
				{
					username: result.value.username,
				},
				{
					email: result.value.email,
				},
			],
		}).lean().exec();
		if (user) {
			return res.status(422).json({
				err: null,
				msg: 'Username or Email already exists, please choose another.',
				data: null,
			});
		}
	}
	result.value.phone = req.body.phone;
	result.value.gender = req.body.gender;
	result.value.aboutme = req.body.aboutme;
	result.value.physicaladdress = req.body.physicaladdress;
	result.value.physicalcity = req.body.physicalcity;
	result.value.physicalstate = req.body.physicalstate;
	result.value.physicalzipcode = req.body.physicalzipcode;
	result.value.shippingaddress = req.body.shippingaddress;
	result.value.shippingcity = req.body.shippingcity;
	result.value.shippingstate = req.body.shippingstate;
	result.value.shippingzipcode = req.body.shippingzipcode;
	result.value.updatedAt = moment().toDate();
	let updatedUser = await User.findByIdAndUpdate(
		req.decodedToken.user._id, {
			$set: result.value,
		},
	).exec();
	if (!updatedUser) {
		return res.status(404).json({
			err: null,
			msg: 'Account not found.',
			data: null,
		});
	}
	updatedUser = await User.findByIdAndUpdate(req.decodedToken.user._id)
	.select('-createdAt -updatedAt')
	.exec();
	if (!updatedUser) {
		return res.status(404).json({
			err: null,
			msg: 'Account not found.',
			data: null,
		});
	}

	const token = jwt.sign(
		{
			user: updatedUser.toObject(),
		},
		config.SECRET,
		{
			expiresIn: '24h',
		},
	);
	res.status(200).json({
		err: null,
		msg: 'Profile was updated successfully.',
		data: token,
	});
};

module.exports.changeProfilePicture = async (req, res) => {
	let setData = {profilePicture: null, updatedAt: moment().toDate()};
	if (req.file) {
		const imagePath = `${config.MEDIA_FOLDER}/${req.decodedToken.user.username}/profilePictures/${req.file.filename}`;
		const url = `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${req.headers.host}/${imagePath}`;
		setData.profilePicture = { path: imagePath, url: url, };
	}
	else {
		setData.profilePicture = null;
	}

	let updatedUser = await User.findByIdAndUpdate(
		req.decodedToken.user._id, {
			$set: setData,
		},
	).exec();
	if (!updatedUser) {
		return res.status(404).json({
			err: null,
			msg: 'Account not found.',
			data: null,
		});
	}
	if (updatedUser.profilePicture && updatedUser.profilePicture.path) {
		await fs.remove(path.resolve('./', updatedUser.profilePicture.path));
	}
	updatedUser = await User.findByIdAndUpdate(req.decodedToken.user._id)
	.select('-createdAt -updatedAt')
	.exec();
	if (!updatedUser) {
		return res.status(404).json({
			err: null,
			msg: 'Account not found.',
			data: null,
		});
	}
	const token = jwt.sign(
		{
			user: updatedUser.toObject(),
		},
		config.SECRET,
		{
			expiresIn: '24h',
		},
	);
	res.status(200).json({
		err: null,
		msg: 'Profile picture was updated successfully.',
		data: token,
	});
};

module.exports.adminChangePassword = async (req, res) => {
	const schema = joi
		.object({
			currentPassword: joi
				.string()
				.trim()
				.required(),
			password: joi
				.string()
				.trim()
				.required()
				.min(8),
			confirmPassword: joi
				.string()
				.trim()
				.required()
				.equal(req.body.password),
		})
		.options({ stripUnknown: true });
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(422).json({
			err: null,
			msg: result.error.details[0].message,
			data: null,
		});
	}
	const user = await Admin.findById(req.decodedToken.user._id).exec();
	if (!user) {
		return res.status(200).json({
			err: null,
			msg: 'Account not found.',
			data: null,
		});
	}
	const passwordMatches = await Encryption.comparePasswordToHash(
		result.value.currentPassword,
		user.password,
	);
	if (!passwordMatches) {
		return res.status(200).json({
			err: null,
			msg: 'Current password is incorrect.',
			data: null,
		});
	}
	user.password = await Encryption.hashPassword(result.value.password);
	await user.save();
	const token = jwt.sign(
		{
			user: user.toObject(),
			admin: true,
		},
		config.SECRET,
		{
			expiresIn: '24h',
		},
	);
	res.status(200).json({
		err: null,
		msg: 'Password was changed successfully.',
		data: token,
	});
};
