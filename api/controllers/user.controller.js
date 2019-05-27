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
	result.value.phone = req.body.phone;
	result.value.gender = req.body.gender;
	result.value.aboutme = req.body.aboutme;
	result.value.tags = req.body.tags;
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
