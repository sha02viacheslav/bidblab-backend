const mongoose = require('mongoose');
const joi = require('joi');
const fs = require('fs-extra');
const moment = require('moment');
const path = require('path');
const config = require('../config');

const User = mongoose.model('User');

module.exports.updateProfile = async (req, res) => {
	const schema = joi
		.object({
			firstName: joi.string().trim(),
			lastName: joi.string().trim(),
			username: joi
				.string()
				.trim()
				.lowercase()
				.alphanum()
				.min(3)
				.max(30),
			email: joi
				.string()
				.trim()
				.lowercase()
				.email(),
			aboutme: joi
				.string(),
			phone: joi
				.string(),
			tags: joi
				.array()
				.items(
					joi.string()
				),
			birthday: joi
				.date(),
			gender: joi
				.string(),
			physicaladdress: joi
				.string(),
			physicalcity: joi
				.string(),
			physicalstate: joi
				.string(),
			physicalzipcode: joi
				.string(),
			shippingaddress: joi
				.string(),
			shippingcity: joi
				.string(),
			shippingstate: joi
				.string(),
			shippingzipcode: joi
				.string(),
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
				$or: [{
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
	}
	if(req.file){
		const imagePath = `${config.MEDIA_FOLDER}/${req.decodedToken.user.username}/profilePictures/${req.file.filename}`;
		const url = `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${req.headers.host}/${imagePath}`;
		result.value.profilePicture =  { path: imagePath, url: url, };
	}
	else{
    result.value.profilePicture = ''
	}
	result.value.updatedAt = moment().toDate();
	let updatedUser = await User.findByIdAndUpdate(
			req.decodedToken.user._id, {
				$set: result.value,
			},
		)
		.exec();
	if (!updatedUser) {
		return res.status(404).json({
			err: null,
			msg: 'Account not found.',
			data: null,
		});
	}
	if (updatedUser.profilePicture) {
    await fs.remove(path.resolve('./', updatedUser.profilePicture.path));
	}
	updatedUser = await User.findByIdAndUpdate( req.decodedToken.user._id )
		.select('-createdAt -updatedAt')
		.exec();
	if (!updatedUser) {
		return res.status(404).json({
			err: null,
			msg: 'Account not found.',
			data: null,
		});
	}
	res.status(200).json({
		err: null,
		msg: 'Profile was updated successfully.',
		data: updatedUser.toObject(),
	});
};
