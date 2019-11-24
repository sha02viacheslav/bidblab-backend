const mongoose = require('mongoose');
const joi = require('joi');
const moment = require('moment');
const rand = require('rand-token');
const path = require('path');
const Validations = require('../utils/validations');
const Encryption = require('../utils/encryption');
const config = require('../config');
const global = require('../global');
const fs = require('fs-extra');

const User = mongoose.model('User');
const Question = mongoose.model('Question');
const Credit = mongoose.model('Credit');
const Tag = mongoose.model('Tag');
const Interest = mongoose.model('Interest');
const Report = mongoose.model('Report');
const Auction = mongoose.model('Auction');
const Mail = mongoose.model('Mail');
const Sitemanager = mongoose.model('Sitemanager');
const Invite = mongoose.model('Invite');
const Login = mongoose.model('Login');

const ObjectId = mongoose.Types.ObjectId;

module.exports.createUser = async (req, res) => {
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
		return res.status(200).json({
			err: null,
			msg: result.error.details[0].message,
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
		return res.status(200).json({
			err: null,
			msg: 'Username or Email already exists, please choose another.',
			data: null,
		});
	}
	result.value.password = await Encryption.hashPassword(result.value.password);
	result.value.verified = true;
	result.value.phone = req.body.phone;
	result.value.birthday = req.body.birthday;
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
	const newUser = await User.create(result.value);
	res.status(201).json({
		err: null,
		msg: 'User was created successfully.',
		data: newUser.toObject(),
	});
};

module.exports.getMembers = async (req, res) => {
	let { offset = 0, limit = 10, search, active, direction } = req.query;
	search = search.replace(/([<>*()?])/g, "\\$1");
	const query = search
		? {
			$or: [
				{
					username: {
						$regex: search,
						$options: 'i',
					},
				},
				{
					firstName: {
						$regex: search,
						$options: 'i',
					},
				},
				{
					lastName: {
						$regex: search,
						$options: 'i',
					},
				},
			],
		}
		: {};
	var sortVariable = {};
	if (active == 'name') {
		if (direction == 'asc') {
			sortVariable['firstName'] = 1;
			sortVariable['lastName'] = 1;
		}
		else if (direction == 'desc') {
			sortVariable['firstName'] = -1;
			sortVariable['lastName'] = -1;
		}
	}
	else {
		if (direction == 'asc') {
			sortVariable[active] = 1;
		}
		else if (direction == 'desc') {
			sortVariable[active] = -1;
		}
		else {
			sortVariable['createdAt'] = -1;
		}
	}
	let start = Number(limit) * Number(offset);
	const size = Number(limit);
	const totalMembers = await User.count(query).exec();
	if (totalMembers <= start) {
		start = 0;
	}
	const members = await User.find(query)
		.lean()
		.sort(sortVariable)
		.skip(start)
		.limit(size)
		.populate({
			path: 'asker',
			select:
				'-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		})
		.populate({
			path: 'answers.answerer',
			select:
				'-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		})
		.exec();

	for (var key in members) {
		members[key].index = start + Number(key);
		members[key].totalQuestions = 0;
		members[key].totalAnswers = 0;
		members[key].totalFollowers = 0;
		members[key].questionCredits = 0;
		members[key].optionalImageCredits = 0;
		members[key].answerCredits = 0;
		members[key].referalCredits = 0;
		members[key].loseCredits = 0;
		let credits = await module.exports.internalGetMyCredits(members[key]._id);
		if (credits) {
			members[key].questionCredits = credits.questionCredits;
			members[key].optionalImageCredits = credits.optionalImageCredits;
			members[key].answerCredits = credits.answerCredits;
			members[key].referalCredits = credits.referalCredits;
			members[key].signupCredits = credits.signupCredits;
			members[key].loseCredits = credits.loseCredits;
		}
		members[key].totalQuestions = await Question.count({ "asker": members[key]._id }).exec();

		question = await Question.aggregate(
			[
				{
					$match: {
						"answers": {
							"$elemMatch": {
								"answerer": members[key]._id
							}
						}
					}
				},
				{ $unwind: "$answers" },
				{
					$match: {
						"answers.answerer": members[key]._id
					}
				},
				{ $project: { "answers": 1, "_id": 0 } },
				{
					$group: {
						_id: "null",
						totalAnswers: {
							$sum: 1
						},
					}
				}
			]
		)
			.exec();
		if (question) {
			if (question[0]) {
				members[key].totalAnswers = question[0].totalAnswers ? question[0].totalAnswers : 0;
			}
		}

		members[key].totalLogins = await Login.count({ "userId": members[key]._id }).exec();
	}
	res.status(200).json({
		err: null,
		msg: 'Users retrieved successfully.',
		data: {
			totalMembers,
			members,
		}
	});
};

module.exports.updateUser = async (req, res) => {
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
		return res.status(200).json({
			err: null,
			msg: result.error.details[0].message,
			data: null,
		});
	}
	if (req.body.password) {
		const schemaPassword = joi
			.object({
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
		const resultPassword = schemaPassword.validate(req.body);
		if (resultPassword.error) {
			return res.status(200).json({
				err: null,
				msg: resultPassword.error.details[0].message,
				data: null,
			});
		}
		result.value.password = await Encryption.hashPassword(resultPassword.value.password);
	}

	result.value.verified = true;
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
	const updatedUser = await User.findByIdAndUpdate(
		req.params.userId,
		{
			$set: result.value,
		},
		{
			new: true,
		},
	).select('-createdAt -updatedAt').exec();
	if (!updatedUser) {
		return res.status(200).json({
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

module.exports.getUser = async (req, res) => {
	if (!Validations.isObjectId(req.params.userId)) {
		return res.status(422).json({
			err: null,
			msg: 'userId parameter must be a valid ObjectId.',
			data: null,
		});
	}
	const user = await User.findById(req.params.userId)
		.lean()
		.select(
			'-password -verificationToken -verificationTokenExpiry -resetPasswordToken -resetPasswordTokenExpiry',
		)
		.exec();
	if (!user) {
		return res
			.status(404)
			.json({ err: null, msg: 'User not found.', data: null });
	}
	res.status(200).json({
		err: null,
		msg: 'User retrieved successfully.',
		data: user,
	});
};

module.exports.resetUserPassword = async (req, res) => {
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
	const user = await User.findByIdAndUpdate(
		req.params.userId,
		{
			$set: {
				password: await Encryption.hashPassword(result.value.password),
			},
		},
		{
			new: true,
		},
	)
		.lean()
		.exec();
	if (!user) {
		return res
			.status(404)
			.json({ err: null, msg: 'User not found.', data: null });
	}
	res.status(200).json({
		err: null,
		msg: 'User password was reset successfully.',
		data: null,
	});
};

module.exports.deleteMembers = async (req, res) => {

	let deletedMembers = [];
	let totalDeleteMembers = 0;

	for (let index in req.body) {
		let deletedUser = await User.findByIdAndRemove(req.body[index])
			.exec();
		if (deletedUser) {
			totalDeleteMembers++;
			deletedMembers.push(deletedUser);
		}
	}
	res.status(200).json({
		err: null,
		msg: 'Member was deleted successfully.',
		data: {
			totalDeleteMembers,
			deletedMembers
		},
	});
};

module.exports.changeMembersRole = async (req, res) => {

	let suspendedMembers = [];
	let totalSuspendMembers = 0;

	for (let index in req.body) {
		let suspendedUser = await User.findByIdAndUpdate(req.body[index],
			{
				$set: {
					role: req.params.roleType,
				}
			}
		)
			.exec();
		if (suspendedUser) {
			totalSuspendMembers++;
			suspendedMembers.push(suspendedUser);
		}
	}
	res.status(200).json({
		err: null,
		msg: 'Member was suspended successfully.',
		data: {
			totalSuspendMembers,
			suspendedMembers
		},
	});
};

module.exports.getLogins = async (req, res) => {
	if (!Validations.isObjectId(req.params.userId)) {
		return res.status(422).json({
			err: null,
			msg: 'userId parameter must be a valid ObjectId.',
			data: null,
		});
	}
	const logins = await Login.find({userId: req.params.userId})
		.lean()
		.exec();
	if (!logins) {
		return res
			.status(404)
			.json({ err: null, msg: 'Data not found.', data: null });
	}
	res.status(200).json({
		err: null,
		msg: 'Data retrieved successfully.',
		data: logins,
	});
};

module.exports.addQuestion = async (req, res) => {
	const schema = joi
		.object({
			title: joi
				.string()
				.trim()
				.max(500)
				.required(),
			priority: joi
				.number()
				.min(1)
				.max(5)
				.required(),
			answerCredit: joi
				.number()
				.min(0)
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

	const defaultCredits = await Credit.find({ dataType: "credit" }).exec();
	if (!defaultCredits) {
		res.status(200).json({
			err: null,
			msg: 'DefaultCredits was not found.',
			data: null,
		});
	}
	//Delete answerCredit if answerCredit is set as same with default public answer credit.
	if (defaultCredits.defaultPublicAnswerCredit == result.value.answerCredit) {
		result.value.answerCredit = null;
	}

	const existingQuestion = await Question.findOne({
		title: {
			$regex: result.value.title,
			$options: 'i',
		},
	})
		.lean()
		.exec();
	if (existingQuestion) {
		return res.status(403).json({
			err: null,
			msg: 'Question already exists, try a different format or rephrasing.',
			data: null,
		});
	}
	result.value.asker = req.decodedToken.admin
		? null
		: req.decodedToken.user._id;
	if (req.file) {
		const imagePath = `${config.MEDIA_FOLDER}/questionPictures/${req.file.filename}`;
		const url = `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${
			req.headers.host}/${imagePath}`;
		result.value.questionPicture = { path: imagePath, url: url, };
	}
	else {
		result.value.questionPicture = '';
	}

	//Add tag if not exist.
	if (!result.value.tags.length || result.value.tags.length > 3) {
		res.status(201).json({
			err: null,
			msg: 'Question tags must be less than or equal to 3.',
			data: null,
		});
	}
	for (var index in result.value.tags) {
		let existingTag = await Tag.findOne({
			tagName: {
				$regex: new RegExp("^" + result.value.tags[index] + "$", "i"),
				$options: 'i',
			},
		})
			.lean()
			.exec();
		if (existingTag) {
			result.value.tags[index] = existingTag.tagName;
		} else {
			let newTag = await Tag.create({ tagName: result.value.tags[index] });
		}
	}

	let newQuestion = await Question.create(result.value);
	newQuestion = await Question.findById(newQuestion._id)
		.lean()
		.exec();
	res.status(201).json({
		err: null,
		msg: 'Question was added successfully.',
		data: newQuestion,
	});
};

module.exports.getQuestions = async (req, res) => {
	let { offset = 0, limit = 10, search, filterTags, active, direction } = req.query;
	search = search.replace(/([<>*()?])/g, "\\$1");
	filterTags = filterTags.trim();
	let tagFilterFlag = false;
	if (filterTags) {
		tagFilterFlag = true;
	}
	let tagsArray = filterTags.replace(/^\[|\]$/g, "").split(",");

	const query =
	{
		$and: [
			search ?
				{
					title: {
						$regex: search,
						$options: 'i',
					},
				} : {},
			tagFilterFlag ? {
				"tags": {
					"$elemMatch": {
						"$in": tagsArray 
					}
				}
			} : {},
		],
	};

	var sortVariable = {};
	if (direction == 'asc') {
		sortVariable[active] = 1;
	}
	else if (direction == 'desc') {
		sortVariable[active] = -1;
	}
	else {
		sortVariable['createdAt'] = -1;
	}
	let start = Number(limit) * Number(offset);
	const size = Number(limit);

	const totalQuestions = await Question.count(query).exec();
	if (totalQuestions <= start) {
		start = 0;
	}

	const questions = await Question.find(query)
		.lean()
		.sort(sortVariable)
		.skip(start)
		.limit(size)
		.populate({
			path: 'asker',
			select:
				'-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		})
		.populate({
			path: 'answers.answerer',
			select:
				'-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		})
		.exec();

	questions.forEach((element, index) => {
		element.index = start + index;
	});

	res.status(200).json({
		err: null,
		msg: 'Questions retrieved successfully.',
		data: {
			totalQuestions,
			questions,
		},
	});
};

module.exports.deleteQuestions = async (req, res) => {

	let deletedQuestions = [];
	let totalDeleteQuestions = 0;

	for (let index in req.body) {
		let deletedQuestion = await Question.findByIdAndRemove(req.body[index])
			.exec();
		if (deletedQuestion) {
			totalDeleteQuestions++;
			deletedQuestions.push(deletedQuestion);
		}
	}
	res.status(200).json({
		err: null,
		msg: 'Question was deleted successfully.',
		data: {
			totalDeleteQuestions,
			deletedQuestions
		},
	});
};

module.exports.changeQuestionsRole = async (req, res) => {

	let suspendedQuestions = [];
	let totalSuspendQuestions = 0;

	for (let index in req.body) {
		let suspendedQuestion = await Question.findByIdAndUpdate(req.body[index],
			{
				$set: {
					role: req.params.roleType,
				}
			}
		)
			.exec();
		if (suspendedQuestion) {
			totalSuspendQuestions++;
			suspendedQuestions.push(suspendedQuestion);
		}
	}
	res.status(200).json({
		err: null,
		msg: 'Question was suspended successfully.',
		data: {
			totalSuspendQuestions,
			suspendedQuestions
		},
	});
};

module.exports.updateQuestion = async (req, res) => {
	if (!Validations.isObjectId(req.body.questionId)) {
		return res.status(200).json({
			err: null,
			msg: 'questionId parameter must be a valid ObjectId.',
			data: null,
		});
	}
	const schema = joi
		.object({
			title: joi
				.string()
				.trim()
				.max(500),
			priority: joi
				.number()
				.min(1)
				.max(5)
				.required(),
			answerCredit: joi
				.number()
				.min(0)
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

	const defaultCredits = await Credit.findOne({ dataType: "credit" }).lean().exec();
	//Delete answerCredit if answerCredit is set as same with default public answer credit.
	if (defaultCredits && defaultCredits.defaultPublicAnswerCredit == result.value.answerCredit) {
		result.value.answerCredit = null;
	}

	if (req.file) {
		const imagePath = `${config.MEDIA_FOLDER}/questionPictures/${req.file.filename}`;
		const url = `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${
			req.headers.host}/${imagePath}`;
		result.value.questionPicture = { path: imagePath, url: url, };
	}
	else {
		result.value.questionPicture = '';
	}

	//Add tag if not exist.
	if (!result.value.tags.length || result.value.tags.length > 3) {
		res.status(201).json({
			err: null,
			msg: 'Question tags must be less than or equal to 3.',
			data: null,
		});
	}
	for (var index in result.value.tags) {
		let existingTag = await Tag.findOne({
			tagName: {
				$regex: new RegExp("^" + result.value.tags[index] + "$", "i"),
				$options: 'i',
			},
		})
			.lean()
			.exec();
		if (existingTag) {
			result.value.tags[index] = existingTag.tagName;
		} else {
			let newTag = await Tag.create({ tagName: result.value.tags[index] });
		}
	}

	const updatedQuestion = await Question.findByIdAndUpdate(
		req.body.questionId,
		{
			$set: result.value,
		},
	)
		.lean()
		.exec();
	if (!updatedQuestion) {
		return res
			.status(404)
			.json({ err: null, msg: 'Question not found.', data: null });
	}
	if (updatedQuestion.questionPicture) {
		await fs.remove(path.resolve('./', updatedQuestion.questionPicture.path));
	}
	res.status(200).json({
		err: null,
		msg: 'Question was updated successfully.',
		data: updatedQuestion,
	});
};

module.exports.deleteQuestion = async (req, res) => {
	if (!Validations.isObjectId(req.params.questionId)) {
		return res.status(422).json({
			err: null,
			msg: 'questionId parameter must be a valid ObjectId.',
			data: null,
		});
	}
	const deletedQuestion = await Question.findByIdAndRemove(
		req.params.questionId,
	)
		.lean()
		.populate({
			path: 'asker',
			select:
				'-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		})
		.populate({
			path: 'answers.answerer',
			select:
				'-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		})
		.exec();
	if (!deletedQuestion) {
		return res
			.status(404)
			.json({ err: null, msg: 'Question not found.', data: null });
	}
	res.status(200).json({
		err: null,
		msg: 'Question was deleted successfully.',
		data: deletedQuestion,
	});
};

module.exports.updateAnswer = async (req, res) => {
	if (
		!(
			Validations.isObjectId(req.params.questionId) &&
			Validations.isObjectId(req.params.answerId)
		)
	) {
		return res.status(422).json({
			err: null,
			msg: 'questionId and answerId parameters must be valid ObjectIds',
			data: null,
		});
	}
	const schema = joi
		.object({
			content: joi
				.string()
				.trim()
				.max(500)
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
	const question = await Question.findById(req.params.questionId).exec();
	if (!question) {
		return res
			.status(404)
			.json({ err: null, msg: 'Question not found.', data: null });
	}
	const answer = question.answers.id(req.params.answerId);
	if (!answer) {
		return res
			.status(404)
			.json({ err: null, msg: 'Answer not found.', data: null });
	}
	answer.content = result.value.content;
	answer.updatedAt = moment().toDate();
	await question.save();
	res.status(200).json({
		err: null,
		msg: 'Answer was updated successfully.',
		data: answer,
	});
};

module.exports.deleteAnswers = async (req, res) => {

	let totalDeletedAnswers = 0;
	const elementIds = req.body;

	for (let index in elementIds) {
		let question = await Question.findById(elementIds[index].questionId).exec();
		if (!question) {
			continue;
		}
		let answer = question.answers.id(elementIds[index].answerId);
		if (!answer) {
			continue;
		}
		answer.remove();
		await question.save();
		totalDeletedAnswers++;
	}
	res.status(200).json({
		err: null,
		msg: 'Answers were deleted successfully.',
		data: totalDeletedAnswers,
	});
};

module.exports.changeAnswersRole = async (req, res) => {

	let totalSuspendAnswers = 0;
	const elementIds = req.body;
	for (let index in elementIds) {
		let question = await Question.findById(elementIds[index].questionId).exec();
		if (!question) {
			continue;
		}
		let answer = question.answers.id(elementIds[index].answerId);
		if (!answer) {
			continue;
		}
		answer.role = req.params.roleType;
		await question.save();
		totalSuspendAnswers++;
	}
	res.status(200).json({
		err: null,
		msg: 'Answers were suspended successfully.',
		data: {
			totalSuspendAnswers
		},
	});
};

module.exports.changeDefaultCredits = async (req, res) => {
	const schema = joi
		.object({
			defaultQuestionCredit: joi
				.number()
				.required(),
			defaultPublicAnswerCredit: joi
				.number()
				.required(),
			defaultPrivateAnswerCredit: joi
				.number()
				.required(),
			defaultOptionalImageCredit: joi
				.number()
				.required(),
			defaultReferralCredit: joi
				.number()
				.required(),
			defaultSignupCredit: joi
				.number()
				.required(),
			defaultFirstAnswerCredit: joi
				.number()
				.required(),
		})
		.options({
			stripUnknown: true,
		});
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(200).json({
			err: null,
			msg: result.error.details[0].message,
			data: null,
		});
	}

	const defaultCredits = await Credit.findOneAndUpdate(
		{ dataType: 'credit' },
		{
			$set: result.value,
		},
		{
			new: true,
			upsert: true
		},
	).lean().exec();

	if (!defaultCredits) {
		return res.status(200).json({
			err: null,
			msg: 'DefaultCredits was not changed.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'DefaultCredits was changed successfully.',
		data: defaultCredits[0],
	});
}

module.exports.getAnswers = async (req, res) => {
	let { offset = 0, limit = 10, search, filterTags, active, direction } = req.query;
	search = search.replace(/([<>*()?])/g, "\\$1");
	filterTags = filterTags.trim();
	let tagFilterFlag = false;
	if (filterTags) {
		tagFilterFlag = true;
	}
	let tagsArray = filterTags.replace(/^\[|\]$/g, "").split(",");
	const query =
	{
		$and: [
			search ?
				{
					title: {
						$regex: search,
						$options: 'i',
					},
				} : {},
			tagFilterFlag ? {
				"tags": {
					"$elemMatch": {
						"$in": tagsArray 
					}
				}
			} : {},
		],
	}

	var sortVariable = {};
	if (direction == 'asc') {
		sortVariable['answers.' + active] = 1;
	}
	else if (direction == 'desc') {
		sortVariable['answers.' + active] = -1;
	}
	else {
		sortVariable['answers.createdAt'] = -1;
	}
	let totalAnswers = await Question.aggregate(
		[
			{ $match: query },
			{ $unwind: "$answers" },
			{
				$group: {
					_id: "null",
					totalAnswers: { $sum: 1 },
				}
			},
		]
	).exec();
	totalAnswers = totalAnswers.length ? totalAnswers[0].totalAnswers : 0;
	let start = Number(limit) * Number(offset);
	const size = Number(limit);
	start = totalAnswers <= start ? 0 : start;

	const answers = await Question.aggregate(
		[
			{ $match: query },
			{ $unwind: "$answers" },
			{ $sort: sortVariable },
			{ $skip: start },
			{ $limit: size }
		]
	).exec();

	await User.populate(
		answers,
		{
			path: 'asker',
			select:
				'-email -password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		}
	);
	await User.populate(
		answers,
		{
			path: 'answers.answerer',
			select:
				'-email -password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		}
	);
	answers.forEach((element, index) => {
		element.index = start + index;
	});

	res.status(200).json({
		err: null,
		msg: 'Answers retrieved successfully.',
		data: {
			totalAnswers,
			answers,
		},
	});
};


module.exports.getTags = async (req, res) => {
	let { offset = 0, limit = 10, search, active, direction } = req.query;
	search = search.replace(/([<>*()?])/g, "\\$1");
	const query = {
		$and: [
			search ? {
				tagName: {
					$regex: search,
					$options: 'i',
				},
			} : {},
		],
	}

	var sortVariable = {};
	if (direction == 'asc') {
		sortVariable[active] = 1;
	}
	else if (direction == 'desc') {
		sortVariable[active] = -1;
	}
	else {
		sortVariable['tagName'] = -1;
	}
	let totalTags = await Tag.count(query).exec();
	let start = Number(limit) * Number(offset);
	const size = Number(limit);
	start = totalTags <= start ? 0 : start;

	let tags = await Tag.find(query)
		.lean()
		.sort(sortVariable)
		.skip(start)
		.limit(size)
		.exec();

	tags.forEach((element, index) => {
		element.index = start + index;
	});

	res.status(200).json({
		err: null,
		msg: 'Answers retrieved successfully.',
		data: {
			totalTags,
			tags,
		},
	});
};

module.exports.addTag = async (req, res) => {
	const schema = joi
		.object({
			tagName: joi
				.string()
				.trim()
				.max(20)
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

	const existingTag = await Tag.findOne({
		title: {
			$regex: new RegExp("^" + result.value.tagName + "$", "i"),
			$options: 'i',
		},
	})
		.lean()
		.exec();
	if (existingTag) {
		return res.status(403).json({
			err: null,
			msg: 'Tag already exists, try a different format or rephrasing.',
			data: null,
		});
	}

	let newTag = await Tag.create(result.value);
	newTag = await Tag.findById(newTag._id).lean().exec();
	res.status(201).json({
		err: null,
		msg: 'Tag was added successfully.',
		data: newTag,
	});
};

module.exports.updateTag = async (req, res) => {
	if (!Validations.isObjectId(req.params.tagId)) {
		return res.status(200).json({
			err: null,
			msg: 'TagId parameter must be a valid ObjectId.',
			data: null,
		});
	}
	const schema = joi
		.object({
			tagName: joi
				.string()
				.trim()
				.max(20),
		})
		.options({
			stripUnknown: true,
		});
	const result = schema.validate(req.body);
	if (result.error) {
		res.status(200).json({
			err: null,
			msg: result.error.details[0].message,
			data: null,
		});
	}

	const existingTag = await Tag.findOne({
		tagName: {
			$regex: new RegExp("^" + result.value.tagName + "$", "i"),
			$options: 'i',
		},
	})
		.lean()
		.exec();
	if (existingTag) {
		return res.status(200).json({
			err: null,
			msg: 'Tag already exists, try a different format or rephrasing.',
			data: null,
		});
	}

	const updatedTag = await Tag.findByIdAndUpdate(
		req.params.tagId,
		{
			$set: result.value,
		},
	)
		.lean()
		.exec();
	if (!updatedTag) {
		res.status(200).json({
			err: null,
			msg: 'Tag was not found.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Tag was updated successfully.',
		data: updatedTag,
	});
};

module.exports.deleteTags = async (req, res) => {

	let totalDeleteTags = 0;

	for (let index in req.body) {
		let deletedTag = await Tag.findByIdAndRemove(req.body[index])
			.exec();
		if (deletedTag) {
			totalDeleteTags++;
		}
	}
	res.status(200).json({
		err: null,
		msg: 'Tags were deleted successfully.',
		data: {
			totalDeleteTags
		},
	});
};

module.exports.getInterests = async (req, res) => {
	let { offset = 0, limit = 10, search, active, direction } = req.query;
	search = search.replace(/([<>*()?])/g, "\\$1");
	const query = {
		$and: [
			search ? {
				tagName: {
					$regex: search,
					$options: 'i',
				},
			} : {},
		],
	}

	var sortVariable = {};
	if (direction == 'asc') {
		sortVariable[active] = 1;
	}
	else if (direction == 'desc') {
		sortVariable[active] = -1;
	}
	else {
		sortVariable['tagName'] = -1;
	}
	let totalTags = await Interest.count(query).exec();
	let start = Number(limit) * Number(offset);
	const size = Number(limit);
	start = totalTags <= start ? 0 : start;

	let tags = await Interest.find(query)
		.lean()
		.sort(sortVariable)
		.skip(start)
		.limit(size)
		.exec();

	tags.forEach((element, index) => {
		element.index = start + index;
	});

	res.status(200).json({
		err: null,
		msg: 'Answers retrieved successfully.',
		data: {
			totalTags,
			tags,
		},
	});
};

module.exports.addInterest = async (req, res) => {
	const schema = joi
		.object({
			tagName: joi
				.string()
				.trim()
				.max(20)
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

	const existingTag = await Interest.findOne({
		title: {
			$regex: new RegExp("^" + result.value.tagName + "$", "i"),
			$options: 'i',
		},
	})
		.lean()
		.exec();
	if (existingTag) {
		return res.status(403).json({
			err: null,
			msg: 'Tag already exists, try a different format or rephrasing.',
			data: null,
		});
	}

	let newTag = await Interest.create(result.value);
	newTag = await Tag.findById(newTag._id).lean().exec();
	res.status(201).json({
		err: null,
		msg: 'Tag was added successfully.',
		data: newTag,
	});
};

module.exports.updateInterest = async (req, res) => {
	if (!Validations.isObjectId(req.params.interestId)) {
		return res.status(200).json({
			err: null,
			msg: 'TagId parameter must be a valid ObjectId.',
			data: null,
		});
	}
	const schema = joi
		.object({
			tagName: joi
				.string()
				.trim()
				.max(20),
		})
		.options({
			stripUnknown: true,
		});
	const result = schema.validate(req.body);
	if (result.error) {
		res.status(200).json({
			err: null,
			msg: result.error.details[0].message,
			data: null,
		});
	}

	const existingTag = await Interest.findOne({
		tagName: {
			$regex: new RegExp("^" + result.value.tagName + "$", "i"),
			$options: 'i',
		},
	})
		.lean()
		.exec();
	if (existingTag) {
		return res.status(200).json({
			err: null,
			msg: 'Tag already exists, try a different format or rephrasing.',
			data: null,
		});
	}

	const updatedTag = await Interest.findByIdAndUpdate(
		req.params.interestId,
		{
			$set: result.value,
		},
	)
		.lean()
		.exec();
	if (!updatedTag) {
		res.status(200).json({
			err: null,
			msg: 'Tag was not found.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Tag was updated successfully.',
		data: updatedTag,
	});
};

module.exports.deleteInterests = async (req, res) => {

	let totalDeleteTags = 0;

	for (let index in req.body) {
		let deletedTag = await Interest.findByIdAndRemove(req.body[index])
			.exec();
		if (deletedTag) {
			totalDeleteTags++;
		}
	}
	res.status(200).json({
		err: null,
		msg: 'Tags were deleted successfully.',
		data: {
			totalDeleteTags
		},
	});
};

module.exports.getFlags = async (req, res) => {
	let { offset = 0, limit = 10, search, filterTags, active, direction } = req.query;
	filterTags = filterTags.trim();
	let tagFilterFlag = false;
	if (filterTags) {
		tagFilterFlag = true;
	}
	let typeArray = filterTags.replace(/^\[|\]$/g, "").split(",");
	const query =
	{
		$and: [
			search ?
				{
					reportNote: {
						$regex: search,
						$options: 'i',
					},
				} : {},
			tagFilterFlag ?
				{
					"reportType": { "$in": typeArray }
				} : {},
		],
	}

	var sortVariable = {};
	if (direction == 'asc') {
		sortVariable[active] = 1;
	}
	else if (direction == 'desc') {
		sortVariable[active] = -1;
	}
	else {
		sortVariable['createdAt'] = -1;
	}
	let totalFlags = await Report.count(query).exec();
	let start = Number(limit) * Number(offset);
	const size = Number(limit);
	start = totalFlags <= start ? 0 : start;
	const flags = await Report.aggregate(
		[
			{ $match: query },
			{
				$lookup: {
					from: "questions",
					localField: "questionId",
					foreignField: "_id",
					as: "questions"
				}
			},
			{
				$addFields: {
					question: { $arrayElemAt: ["$questions", 0] }
				},
			},
			{
				$addFields: {
					answer: { 
						$cond: { 
							if: "$answerId", 
							then: { $arrayElemAt: ["$question.answers", { "$indexOfArray": ["$question.answers._id", "$answerId"] }] }, 
							else: null 
						} 
					}
				},
			},
			{
				$project: {
					"questions": 0,
				}
			},
			// { $sort : sortVariable },
			{ $skip: start },
			{ $limit: size }
		]
	).exec();

	await User.populate(
		flags,
		{
			path: 'reporter',
			select:
				'-email -password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		}
	);
	await User.populate(
		flags,
		{
			path: 'answerer',
			select:
				'-email -password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		}
	);
	await User.populate(
		flags,
		{
			path: 'asker',
			select:
				'-email -password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		}
	);
	
	flags.forEach((element, index) => {
		element.index = start + index;
	});

	res.status(200).json({
		err: null,
		msg: 'Flags retrieved successfully.',
		data: {
			totalFlags,
			flags,
		},
	});
};

module.exports.changeFlagsRole = async (req, res) => {

	let suspendedFlags = [];
	let totalSuspendFlags = 0;

	for (let index in req.body) {
		let suspendedFlag = await Report.findByIdAndUpdate(req.body[index],
			{
				$set: {
					role: req.params.roleType,
				}
			}
		)
			.exec();
		if (suspendedFlag) {
			totalSuspendFlags++;
			suspendedFlags.push(suspendedFlag);
		}
	}
	res.status(200).json({
		err: null,
		msg: 'Flags was suspended successfully.',
		data: {
			totalSuspendFlags,
			suspendedFlags
		},
	});
};

module.exports.deleteFlags = async (req, res) => {

	let deletedFlags = [];
	let totalDeleteFlags = 0;

	for (let index in req.body) {
		let deletedFlag = await Report.findByIdAndRemove(req.body[index])
			.exec();
		if (deletedFlag) {
			totalDeleteFlags++;
			deletedFlags.push(deletedFlag);
		}
	}
	res.status(200).json({
		err: null,
		msg: 'Question was deleted successfully.',
		data: {
			totalDeleteFlags,
			deletedFlags
		},
	});
};

module.exports.getPendingAuctions = async (req, res) => {
	await global.changeAuctionRole();
	let { offset = 0, limit = 10, search, auctionType = 0, active, direction } = req.query;
	search = search.replace(/([<>*()?])/g, "\\$1");
	const query =
	{
		$and: [
			search ?
				{
					productName: {
						$regex: search,
						$options: 'i',
					},
				} : {},
			{
				role: { 
					$bitsAnySet: [
						global.data().auctionRole.pending
					] 
				} 
			},
		],
	};

	var sortVariable = {};
	if (direction == 'asc') {
		sortVariable[active] = 1;
	}
	else if (direction == 'desc') {
		sortVariable[active] = -1;
	}
	else {
		sortVariable['createdAt'] = -1;
	}
	let start = Number(limit) * Number(offset);
	const size = Number(limit);

	const totalAuctions = await Auction.count(query).exec();
	if (totalAuctions <= start) {
		start = 0;
	}
	const auctions = await Auction.find(query)
		.lean()
		.sort(sortVariable)
		.skip(start)
		.limit(size)
		.exec();

	auctions.forEach((element, index) => {
		element.index = start + index;
	});

	res.status(200).json({
		err: null,
		msg: 'Auctions retrieved successfully.',
		data: {
			totalAuctions,
			auctions,
		},
	});
};

module.exports.getProcessAuctions = async (req, res) => {
	await global.changeAuctionRole();
	let { offset = 0, limit = 10, search, auctionType = 0, active, direction } = req.query;
	search = search.replace(/([<>*()?])/g, "\\$1");
	const query =
	{
		$and: [
			search ?
				{
					productName: {
						$regex: search,
						$options: 'i',
					},
				} : {},
			{
				role: { 
					$bitsAnySet: [
						global.data().auctionRole.process
					] 
				} 
			},
		],
	};

	var sortVariable = {};
	if (direction == 'asc') {
		sortVariable[active] = 1;
	}
	else if (direction == 'desc') {
		sortVariable[active] = -1;
	}
	else {
		sortVariable['createdAt'] = -1;
	}
	let start = Number(limit) * Number(offset);
	const size = Number(limit);

	const totalAuctions = await Auction.count(query).exec();
	if (totalAuctions <= start) {
		start = 0;
	}
	const auctions = await Auction.find(query)
		.lean()
		.sort(sortVariable)
		.skip(start)
		.limit(size)
		.populate({
			path: 'bids.bidder',
			select:
				'-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		})
		.exec();

	for (var key in auctions) {
		auctions[key].index = start + Number(key);
		auctions[key] = await module.exports.checkBids(auctions[key]);
	}

	res.status(200).json({
		err: null,
		msg: 'Auctions retrieved successfully.',
		data: {
			totalAuctions,
			auctions,
		},
	});
};

module.exports.getClosedAuctions = async (req, res) => {
	await global.changeAuctionRole();
	let { offset = 0, limit = 10, search, auctionType = 0, active, direction } = req.query;
	search = search.replace(/([<>*()?])/g, "\\$1");
	const query =
	{
		$and: [
			search ?
				{
					productName: {
						$regex: search,
						$options: 'i',
					},
				} : {},
			{
				role: { 
					$bitsAnySet: [
						global.data().auctionRole.closed
					] 
				} 
			},
			// tagFilterFlag?{
			//     "tag": { "$in": interestArray }
			// }:{},
		],
	};

	var sortVariable = {};
	if (direction == 'asc') {
		sortVariable[active] = 1;
	}
	else if (direction == 'desc') {
		sortVariable[active] = -1;
	}
	else {
		sortVariable['createdAt'] = -1;
	}
	let start = Number(limit) * Number(offset);
	const size = Number(limit);

	const totalAuctions = await Auction.count(query).exec();
	if (totalAuctions <= start) {
		start = 0;
	}
	const auctions = await Auction.find(query)
		.lean()
		.sort(sortVariable)
		.skip(start)
		.limit(size)
		.populate({
			path: 'bids.bidder',
			select:
				'-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		})
		.exec();

	for (var key in auctions) {
		auctions[key].index = start + Number(key);
		auctions[key] = await module.exports.checkBids(auctions[key]);
	}
	res.status(200).json({
		err: null,
		msg: 'Auctions retrieved successfully.',
		data: {
			totalAuctions,
			auctions,
		},
	});
};

module.exports.changeAuctionsRole = async (req, res) => {

	let suspendedAuctions = [];
	let totalSuspendAuctions = 0;

	for (let index in req.body) {
		let suspendedAuction = await Auction.findByIdAndUpdate(req.body[index],
			{
				$set: {
					role: req.params.roleType,
				}
			}
		)
			.exec();
		if (suspendedAuction) {
			totalSuspendAuctions++;
			suspendedAuctions.push(suspendedAuction);
		}
	}

	res.status(200).json({
		err: null,
		msg: 'Auctions was suspended successfully.',
		data: {
			totalSuspendAuctions,
			suspendedAuctions
		},
	});
};

module.exports.deleteAuctions = async (req, res) => {

	let deletedAuctions = [];
	let totalDeleteAuctions = 0;

	for (let index in req.body) {
		let deletedAuction = await Auction.findByIdAndRemove(req.body[index])
			.exec();
		if (deletedAuction) {
			totalDeleteAuctions++;
			deletedAuctions.push(deletedAuction);
		}
	}
	res.status(200).json({
		err: null,
		msg: 'Question was deleted successfully.',
		data: {
			totalDeleteAuctions,
			deletedAuctions
		},
	});
};

module.exports.addAuction = async (req, res) => {
	const schema = joi
		.object({
			auctionTitle: joi
				.string()
				.trim()
				.max(100)
				.required(),
			bidblabPrice: joi
				.number()
				.required(),
			retailPrice: joi
				.number()
				.min(Number(req.body.bidblabPrice))
				.required(),
			bidFee: joi
				.number()
				.required(),
			starts: joi
				.date()
				.min(new Date())
				.required(),
			closes: joi
				.date()
				.min(new Date(req.body.starts))
				.required(),
			auctionSerial: joi
				.number()
				.required(),
		})
		.options({
			stripUnknown: true,
		});
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(200).json({
			msg: result.error.details[0].message,
			err: null,
			data: null,
		});
	}
	let finalAuctionSerial = await getNextAuctionSerial();
	if (finalAuctionSerial != req.body.auctionSerial) {
		res.status(200).json({
			err: null,
			msg: 'AuctionID is invalid. Try again.',
			data: null,
		});
	}

	result.value.role &= 1 << global.data().auctionRole.pending;
	result.value.auctionDetail = req.body.auctionDetail;
	const newAuction = await Auction.create(result.value);

	if (req.files.length && newAuction) {
		if (newAuction.auctionPicture.length) {
			await fs.remove(path.resolve('./', newAuction.auctionPicture));
		}
		let imagePath = [];
		req.files.forEach(element => {
			imagePath.push(`${config.MEDIA_FOLDER}/auctionPictures/${element.filename}`);
		});
		newAuction.auctionPicture = imagePath;
		await newAuction.save();
	}

	if (!newAuction) {
		res.status(200).json({
			err: null,
			msg: 'Auction was not added.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Auction was added successfully.',
		data: newAuction,
	});
};

module.exports.updateAuction = async (req, res) => {
	if (!Validations.isObjectId(req.body.auctionId)) {
		return res.status(200).json({
			err: null,
			msg: 'auctionId parameter must be a valid ObjectId.',
			data: null,
		});
	}
	const schema = joi
		.object({
			auctionTitle: joi
				.string()
				.trim()
				.max(100)
				.required(),
			bidblabPrice: joi
				.number()
				.required(),
			retailPrice: joi
				.number()
				.min(Number(req.body.bidblabPrice))
				.required(),
			bidFee: joi
				.number()
				.required(),
			starts: joi
				.date()
				.required(),
			closes: joi
				.date()
				.min(new Date(req.body.starts))
				.required(),
			auctionSerial: joi
				.number()
				.required(),
		})
		.options({
			stripUnknown: true,
		});
	const result = schema.validate(req.body);
	if (result.error) {
		return res.status(200).json({
			msg: result.error.details[0].message,
			err: null,
			data: null,
		});
	}

	const auction = await Auction.find(
		{
			$and:
				[
					{ _id: { $ne: ObjectId(req.body.auctionId) } },
					{ auctionSerial: req.body.auctionSerial },
				]
		}
	)
		.lean()
		.exec();

	if (auction.length) {
		return res.status(200).json({
			err: null,
			msg: 'AuctionID is deplicated. Try again.',
			data: null,
		});
	}

	if (result.value.starts > new Date()) {
		result.value.role &= 1 << global.data().auctionRole.pending;
	}
	else if (result.value.closes < new Date()) {
		result.value.role &= 1 << global.data().auctionRole.process;
	}
	else {
		result.value.role &= 1 << global.data().auctionRole.closed;
	}
	result.value.auctionDetail = req.body.auctionDetail;
	result.value.updatedAt = moment().toDate();
	const newAuction = await Auction.findByIdAndUpdate(
		req.body.auctionId,
		{
			$set: result.value,
		},
		{ new: true },
	)
		.exec();

	if (newAuction) {
		for (var index = 0; newAuction.auctionPicture[index]; index++) {
			await fs.remove(path.resolve('./', newAuction.auctionPicture[index]));
		}
		let imagePath = [];
		req.files.forEach(element => {
			imagePath.push(`${config.MEDIA_FOLDER}/auctionPictures/${element.filename}`);
		});
		newAuction.auctionPicture = imagePath;
		await newAuction.save();
	}

	if (!newAuction) {
		return res.status(200).json({
			err: null,
			msg: 'Auction was not updated.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Auction was updated successfully.',
		data: newAuction,
	});
};

getNextAuctionSerial = async () => {
	let auction = await Auction.aggregate(
		[
			{
				$group: {
					_id: "null",
					maxAuctionSerial: {
						$max: '$auctionSerial'
					},
					cntAuctionSerial: {
						$sum: 1
					},
				}
			}
		]
	).exec();

	let maxAuctionSerial = 0;
	if (auction.length && auction[0].maxAuctionSerial) {
		maxAuctionSerial = auction[0].maxAuctionSerial;
	}
	maxAuctionSerial++;

	return maxAuctionSerial;
};

module.exports.getDataForAddAuction = async (req, res) => {

	let finalAuctionSerial = await getNextAuctionSerial();

	res.status(200).json({
		err: null,
		msg: 'Auction serial was found successfully.',
		data: {
			finalAuctionSerial: finalAuctionSerial,
		},
	});
};

module.exports.internalGetMyCredits = async (userId) => {

	if (!Validations.isObjectId(userId)) {
		return data = {};
	}

	let question = await Question.aggregate(
		[
			{
				$match: {
					"asker": ObjectId(userId)
				}
			},
			{
				$group: {
					_id: "null",
					questionCredits: {
						$sum: "$credit"
					},
					optionalImageCredits: {
						$sum: "$optionalImageCredit"
					}
				}
			}
		]
	)
		.exec();
	let questionCredits = 0;
	if (question && question[0] && question[0].questionCredits) {
		questionCredits = question[0].questionCredits;
	}
	let optionalImageCredits = 0;
	if (question && question[0] && question[0].optionalImageCredits) {
		optionalImageCredits = question[0].optionalImageCredits;
	}

	question = await Question.aggregate(
		[
			{
				$match: {
					"answers": {
						"$elemMatch": {
							"answerer": ObjectId(userId)
						}
					}
				}
			},
			{ $unwind: "$answers" },
			{
				$match: { "answers.answerer": ObjectId(userId) }
			},
			{ $project: { "answers": 1, "_id": 0 } },
			{
				$group: {
					_id: "null",
					answerCredits: { $sum: "$answers.credit" }
				}
			}
		]
	)
		.exec();

	let answerCredits = 0;
	if (question && question[0] && question[0].answerCredits) {
		answerCredits = question[0].answerCredits;
	}

	const user = await User.findById(userId).exec();
	const invite = await Invite.aggregate(
		[
			{
				$match: {
					$or: [
						{ "referrer": ObjectId(userId) },
						{ "friendEmail": user.email },
					],
					"success": true,
				}
			},
			{
				$group: {
					_id: "null",
					referalCredits: {
						$sum: "$referralCredit"
					},
				}
			}
		]
	)
		.exec();

	let referalCredits = 0;
	if (invite && invite[0] && invite[0].referalCredits) {
		referalCredits = invite[0].referalCredits;
	}

	let auction = await Auction.aggregate(
		[
			{
				$match: {
					"bids": {
						"$elemMatch": {
							"bidder": ObjectId(userId)
						}
					}
				}
			},
			{ $unwind: "$bids" },
			{
				$match: {
					"bids.bidder": ObjectId(userId)
				}
			},
			{ $project: { "bids": 1, "bidFee": 1, "_id": 0 } },
			{
				$group: {
					_id: "null",
					loseCredits: {
						$sum: "$bidFee"
					}
				}
			}
		]
	)
		.exec();
	let loseCredits = 0;
	if (auction) {
		if (auction[0]) {
			if (auction[0].loseCredits) {
				loseCredits = auction[0].loseCredits;
			}
		}
	}

	const defaultCredits = await Credit.findOne({ dataType: "credit" }).exec();
	let signupCredits = 50;
	if (defaultCredits && defaultCredits.defaultSignupCredit) {
		signupCredits = defaultCredits.defaultSignupCredit;
	}

	return data = {
		questionCredits,
		optionalImageCredits,
		answerCredits,
		referalCredits,
		signupCredits,
		loseCredits,
	};

}

module.exports.checkBids = async (auction) => {

	let tempBids = auction.bids;
	let maxUniqueBid = '';
	for (index = auction.bids.length - 1; index >= 0; index--) {
		auction.bids[index].bidStatus = 0;
		if (tempBids.some(item => item.bidPrice == auction.bids[index].bidPrice && item._id != auction.bids[index]._id)) {
			auction.bids[index].bidStatus = 1 << 0;
		} else {
			// uniqueBids.push(auction.auction.bids[index]);
			if (!maxUniqueBid || maxUniqueBid.bidPrice < auction.bids[index].bidPrice) {
				maxUniqueBid = auction.bids[index];
			}
		}
	}
	auction.maxUniqueBid = maxUniqueBid;
	if (maxUniqueBid) {
		let temp = auction.bids.find(item => item._id == auction.maxUniqueBid._id);
		temp.bidStatus |= 1 << 1;
	}

	return auction;
}

module.exports.saveAbout = async (req, res) => {

	const schema = joi
		.object({
			quillContent: joi
				.string()
				.trim()
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
	const updatedAbout = await Sitemanager.findOneAndUpdate(
		{ pageType: 'about' },
		{
			$set: result.value,
		},
		{
			new: true,
			upsert: true
		},
	)
		.lean()
		.exec();

	if (!updatedAbout) {
		return res.status(422).json({
			msg: 'About page was not found.',
			err: null,
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'About page was changed successfully.',
		data: "succes"
	});
};

module.exports.saveHow = async (req, res) => {

	const schema = joi
		.object({
			quillContent: joi
				.string()
				.trim()
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
	const updatedAbout = await Sitemanager.findOneAndUpdate(
		{ pageType: 'how' },
		{
			$set: result.value,
		},
		{
			new: true,
			upsert: true
		},
	)
		.lean()
		.exec();

	if (!updatedAbout) {
		return res.status(422).json({
			msg: 'How it works page was not found.',
			err: null,
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'How it works page was changed successfully.',
		data: "succes"
	});
};

module.exports.saveTerms = async (req, res) => {

	const schema = joi
		.object({
			quillContent: joi
				.string()
				.trim()
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
	const updatedAbout = await Sitemanager.findOneAndUpdate(
		{ pageType: 'terms' },
		{
			$set: result.value,
		},
		{
			new: true,
			upsert: true
		},
	)
		.lean()
		.exec();

	if (!updatedAbout) {
		return res.status(422).json({
			msg: 'Terms of service page was not found.',
			err: null,
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Terms of service page was changed successfully.',
		data: "succes"
	});
};

module.exports.saveCookie = async (req, res) => {

	const schema = joi
		.object({
			quillContent: joi
				.string()
				.trim()
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
	const updatedAbout = await Sitemanager.findOneAndUpdate(
		{ pageType: 'cookie' },
		{
			$set: result.value,
		},
		{
			new: true,
			upsert: true
		},
	)
		.lean()
		.exec();

	if (!updatedAbout) {
		return res.status(422).json({
			msg: 'Cookie page was not found.',
			err: null,
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Cookie page was changed successfully.',
		data: "succes"
	});
};

module.exports.savePrivacy = async (req, res) => {

	const schema = joi
		.object({
			quillContent: joi
				.string()
				.trim()
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
	const updatedAbout = await Sitemanager.findOneAndUpdate(
		{ pageType: 'privacy' },
		{
			$set: result.value,
		},
		{
			new: true,
			upsert: true
		},
	)
		.lean()
		.exec();

	if (!updatedAbout) {
		return res.status(422).json({
			msg: 'Privacy page was not found.',
			err: null,
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Privacy page was changed successfully.',
		data: "succes"
	});
};

module.exports.saveInvestor = async (req, res) => {

	const schema = joi
		.object({
			quillContent: joi
				.string()
				.trim()
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
	const updatedAbout = await Sitemanager.findOneAndUpdate(
		{ pageType: 'investor' },
		{
			$set: result.value,
		},
		{
			new: true,
			upsert: true
		},
	)
		.lean()
		.exec();

	if (!updatedAbout) {
		return res.status(422).json({
			msg: 'Investor Relations page was not found.',
			err: null,
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Privacy page was changed successfully.',
		data: "succes"
	});
};

module.exports.getMails = async (req, res) => {
	let { offset = 0, limit = 10, search, type = 0, active, direction } = req.query;
	search = search.replace(/([<>*()?])/g, "\\$1");
	const query =
	{
		$and: [
			search ?
				{
					message: {
						$regex: search,
						$options: 'i',
					},
				} : {},
			{
				$or: [
					type & (global.data().mailRole.inbox) ? {
						role: global.data().mailRole.sent,
						sender: { $ne: null },
						"recievers": null,
					} : { _id: null },
					type & (global.data().mailRole.sent) ? {
						role: global.data().mailRole.sent,
						sender: null,
						"recievers": { $ne: null },
					} : { _id: null },
					type & (global.data().mailRole.archived) ? {
						role: global.data().mailRole.archived,
						sender: null,
					} : { _id: null },
					type & (global.data().mailRole.trash) ? {
						role: global.data().mailRole.adminTrash
					} : { _id: null },
				]
			}
		],
	};

	var sortVariable = {};
	if (direction == 'asc') {
		sortVariable[active] = 1;
	}
	else if (direction == 'desc') {
		sortVariable[active] = -1;
	}
	else {
		sortVariable['createdAt'] = -1;
	}
	let start = Number(limit) * Number(offset);
	const size = Number(limit);

	const totalMails = await Mail.count(query).exec();
	if (totalMails <= start) {
		start = 0;
	}

	const mails = await Mail.find(query)
		.lean()
		.sort(sortVariable)
		.skip(start)
		.limit(size)
		.populate({
			path: 'sender',
			select:
				'-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		})
		.populate({
			path: 'recievers.reciever',
			select:
				'-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
		})
		.exec();

	mails.forEach((element, index) => {
		element.index = start + index;
	});

	res.status(200).json({
		err: null,
		msg: 'Mails retrieved successfully.',
		data: {
			totalMails,
			mails,
		},
	});
};

module.exports.sendMessage = async (req, res) => {
	const schema = joi
		.object({
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

	var recieversName = req.body.recievers.split(',');
	const recievers = await User.aggregate([
		{
			$match: {
				"username": {
					$in: recieversName
				}
			}
		},
		{
			$group: {
				recieversEmail: { "$push": "$email" },
				recieversId: { "$push": "$_id" },
				"_id": null,
			}
		},
	]).exec();
	if (!recievers.length) {
		return res.status(422).json({
			msg: 'You must select valid username.',
			err: null,
			data: null,
		});
	}

	result.value.sender = null;
	result.value.subject = req.body.subject.trim();
	result.value.message = req.body.message.trim();
	result.value.role = global.data().mailRole.sent;
	const newMail = await Mail.create(result.value);
	var recieversId = recievers[0].recieversId;
	for (var index in recieversId) {
		let reciever = newMail.recievers.create({ reciever: recieversId[index], role: 0 });
		newMail.recievers.push(reciever);
		await newMail.save();
	}

	const mailgun = require("mailgun-js");
	const DOMAIN = 'verify.bidblab.com';
	const mg = new mailgun({ apiKey: '1c483f030a25d74004bd2083d3f42585-b892f62e-b1b60d12', domain: DOMAIN });

	const data = {
		from: 'Bidblab <support@bidblab.com>',
		to: recievers[0].recieversEmail,
		subject: newMail.subject,
		html: newMail.message,
	};
	mg.messages().send(data);

	res.status(200).json({
		err: null,
		msg: 'Message was sent successfully.',
		data: "succes"
	});
};

module.exports.applyRoleOfMails = async (req, res) => {

	const mails = await Mail.find({ "_id": { $in: req.body } }).exec();
	for (var index in mails) {
		mails[index].role = global.data().mailRole.adminTrash;
		await mails[index].save();
	}

	res.status(200).json({
		err: null,
		msg: 'Message was archived successfully.',
		data: "succes"
	});
};

// module.exports.archiveMessage = async (req, res) => {

//   const schema = joi
//     .object({
//     })
//     .options({
//       stripUnknown: true,
//     });
//   const result = schema.validate(req.body);

//   if (result.error) {
//     return res.status(422).json({
//       msg: result.error.details[0].message,
//       err: null,
//       data: null,
//     });
//   }

//   var recieversName = req.body.recievers.split(',');
//   const recievers = await User.aggregate([
//     {
//       $match: {
//         "username" : {
//           $in: recieversName
//         }
//       }
//     },
//     {
//       $group: {
//         recieversEmail: { "$push": "$email" },
//         recieversId: { "$push": "$_id" },
//         "_id": null,
//       }
//     },
//   ]).exec();
//   result.value.sender = null;
//   result.value.subject = req.body.subject.trim();
//   result.value.message = req.body.message.trim();
//   result.value.role = global.data().mailRole.archived;
//   result.value.recievers = recievers[0].recieversId;
//   const newMail = await Mail.create(result.value);

//   res.status(200).json({
//     err: null,
//     msg: 'Message was archived successfully.',
//     data: "succes"
//   });
// };


module.exports.sendVerifylink = async (req, res) => {

	for (let index in req.body.userIds) {
		let user = await User.findById(req.body.userIds[index]).exec();
		
		if (user && !user.verified) {
			user.verificationToken = rand.generate(32);
			user.verificationTokenExpiry = moment().add(24, 'hours').toDate();
			await user.save();

			const mailgun = require("mailgun-js");
			const DOMAIN = 'verify.bidblab.com';
			const mg = new mailgun({ apiKey: '1c483f030a25d74004bd2083d3f42585-b892f62e-b1b60d12', domain: DOMAIN });

			const data = {
				from: 'Bidblab <support@bidblab.com>',
				to: user.email,
				subject: 'Account Verification',
				html: `<p>Hello <span style="font-weight: bold">${user.username}</span>, You are signed up but not verified your email address. <br>
					Please click on the following link to verify your account: <a href="${
					config.FRONTEND_URI
					}/gateway/verifyAccount/${user.verificationToken}" style="color: #e91e63;">Verify</a></p>`,
			};
			mg.messages().send(data);
		}
	}

	res.status(200).json({
		err: null,
		msg: 'Verify link was sent successfully.',
		data: "succes"
	});
};




