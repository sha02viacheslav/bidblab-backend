const mongoose = require('mongoose');
const joi = require('joi');
const moment = require('moment');
const Validations = require('../utils/validations');
const Encryption = require('../utils/encryption');

const User = mongoose.model('User');
const Question = mongoose.model('Question');
const Credit = mongoose.model('Credit');
const Interest = mongoose.model('Interest');

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

  const { offset = 0, limit = 10, search, active, direction } = req.query;
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
  if(active == 'name'){
    if(direction == 'asc'){
      sortVariable['firstName'] = 1;
      sortVariable['lastName'] = 1;
    }
    else if(direction == 'desc'){
      sortVariable['firstName'] = -1;
      sortVariable['lastName'] = -1;
    }
  }
  else{
    if(direction == 'asc'){
      sortVariable[active] = 1;
    }
    else if(direction == 'desc'){
      sortVariable[active] = -1;
    }
  }
  let start = Number(limit) * Number(offset);
  const size = Number(limit);
  const totalMembers = await User.count(query).exec();
  if(totalMembers <= start){
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
  
  for(var key in members){
    members[key].index = start + Number(key);
    members[key].totalQuestions = 0;
    members[key].totalAnswers = 0;
    members[key].totalFollowers = 0;
    members[key].questionCredits = 0;
    members[key].answerCredits = 0;
    members[key].referalCredits = 0;
    let question = await Question.aggregate(
      [
        { 
          $match: {
            "asker": members[key]._id   
          }
        },
        {
          $group: {
            _id: "null", 
            totalQuestions: {
              $sum: 1
            },
            questionCredits: {
              $sum: "$credit"
            }
          }
        }
      ]
    )
    .exec();

    if(question){
      if(question[0]){
        members[key].totalQuestions = question[0].totalQuestions? question[0].totalQuestions : 0;
        members[key].questionCredits = question[0].questionCredits? question[0].questionCredits : 0;
      }
    }

    question = await Question.aggregate(
      [
        { 
          $match: { 
            "answers":{
              "$elemMatch": {
                "answerer": members[key]._id
              }
            }   
          }
        },
        { $unwind : "$answers" },
        { 
          $match: { 
            "answers.answerer": members[key]._id  
          }
        },
        { $project : { "answers" : 1, "_id": 0 } },
        {
          $group: {
            _id: "null", 
            totalAnswers: {
              $sum: 1
            },
            answerCredits: {
              $sum: "$answers.credit"
            }
          }
        }
      ]
    )
    .exec();
    if(question){
      if(question[0]){
        members[key].totalAnswers = question[0].totalAnswers? question[0].totalAnswers : 0;
        members[key].answerCredits = question[0].answerCredits? question[0].answerCredits : 0;
      }
    }
    if(question){
      if(question[0]){
        members[key].referalCredits = question[0].answerCredits? question[0].answerCredits : 0;
      }
    }
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
    if(req.body.password){
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
	result.value.updatedAt = moment().toDate();
	const updatedUser = await User.findByIdAndUpdate(
		req.params.userId,
		{
			$set: result.value,
		},
		{
			new: true,
		},
	)
    .select('-createdAt -updatedAt')
    .exec();
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

  for(let index in req.body){
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

  for(let index in req.body){
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

module.exports.getQuestions = async (req, res) => {
  let { offset = 0, limit = 10, search, filterTags, active, direction } = req.query; 
  filterTags = filterTags.trim();
  let tagFilterFlag = false;
  if(filterTags){
    tagFilterFlag = true;
  }
  let interestArray = filterTags.replace(/^\[|\]$/g, "").split(",");
  
  const query = 
    {
      $and: [
        search?
        {
          title: {
            $regex: search,
            $options: 'i',
          },
        }:{},
        tagFilterFlag?{
            "tag": { "$in": interestArray }
        }:{},
      ],
    };
  
  var sortVariable = {};
  if(direction == 'asc'){
    sortVariable[active] = 1;
  }
  else if(direction == 'desc'){
    sortVariable[active] = -1;
  }
  let start = Number(limit) * Number(offset);
  const size = Number(limit);

  const totalQuestions = await  Question.count(query).exec();
  if(totalQuestions <= start){
    start = 0;
  }
  let questionTags = await Question.aggregate([
    {
      $group: {
        _id: "$tag",
      }
    },
    {
      $group: {
        _id: "null",
        tags: { "$push": "$_id" }
      }
    }
  ]) .exec();
  questionTags = questionTags[0].tags;
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
      
  questions.forEach(( element, index ) => {
    element.index = start + index;
  });

  res.status(200).json({
    err: null,
    msg: 'Questions retrieved successfully.',
    data: {
      totalQuestions,
      questionTags,
      questions,
    },
  });
};

module.exports.deleteQuestions = async (req, res) => {

  let deletedQuestions = [];
  let totalDeleteQuestions = 0;

  for(let index in req.body){
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

  for(let index in req.body){
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
  if (!Validations.isObjectId(req.params.questionId)) {
    return res.status(422).json({
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
      tag: joi
        .string()
        .trim()
        .max(15),
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
  result.value.updatedAt = moment().toDate();
  const updatedQuestion = await Question.findByIdAndUpdate(
    req.params.questionId,
    {
      $set: result.value,
    },
    { new: true },
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
  if (!updatedQuestion) {
    return res
      .status(404)
      .json({ err: null, msg: 'Question not found.', data: null });
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

module.exports.deleteAnswer = async (req, res) => {
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
  answer.remove();
  await question.save();
  res.status(200).json({
    err: null,
    msg: 'Answer was deleted successfully.',
    data: answer,
  });
};


module.exports.sendMessage = async (req, res) => {
  
  const mailgun = require("mailgun-js");
  const DOMAIN = 'verify.bidblab.com';
  const mg = new mailgun({apiKey: '1c483f030a25d74004bd2083d3f42585-b892f62e-b1b60d12', domain: DOMAIN});

  const data = {
    from: 'Bidblab <support@bidblab.com>',
    to: req.body.to,
    subject: req.body.subject,
    text: req.body.message,
  };
  mg.messages().send(data);

  res.status(201).json({
    err: null,
    msg: 'User was created successfully.',
    data: "succes"
  });
};

module.exports.getDefaultCredits  = async (req, res) => {
	const defaultCredits = await Credit.find({ dataType: "credit"})
	.exec();
	if (!defaultCredits) {
		res.status(200).json({
			err: null,
			msg: 'DefaultCredits was not found.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'StandardInterests was found successfully.',
		data: defaultCredits[0],
	});
}

module.exports.changeDefaultCredits  = async (req, res) => {
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
				.required()
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
	const defaultCredits = await Credit.findByIdAndUpdate(
		req.body._id,
		{
			$set: result.value,
		},
		{
			new: true,
		},
	)
	.exec();
	if (!defaultCredits) {
		res.status(200).json({
			err: null,
			msg: 'DefaultCredits was not changed.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'DefaultCredits was found successfully.',
		data: defaultCredits[0],
	});
}



module.exports.getAnswers = async (req, res) => {
	let { offset = 0, limit = 10, search, filterTags, active, direction } = req.query; 
	filterTags = filterTags.trim();
	let tagFilterFlag = false;
	if(filterTags){
	  	tagFilterFlag = true;
	}
	let interestArray = filterTags.replace(/^\[|\]$/g, "").split(",");
	const query =	
		{
			// "answers": {
			// 	"$elemMatch": {
			// 		"answerer": req.query.userId,
			// 		"answertype": "public",
			// 	}
			// },
			$and: [
				search?
					{
						title: {
						$regex: search,
						$options: 'i',
						},
					}: { },
				tagFilterFlag?
					{
						"tag": { "$in": interestArray }
					}: { },
			],
		}
	
	var sortVariable = {};
	if(direction == 'asc'){
	  	sortVariable[active] = 1;
	}
	else if(direction == 'desc'){
		sortVariable[active] = -1;
  }
  console.log(sortVariable);
	let totalAnswers = await Question.aggregate(
		[
			{ $match: query },
			{ $unwind : "$answers" },
			{ $group : { 
				_id: "null", 
				totalAnswers: { $sum: 1 },
			}},
		]
  	).exec();
	totalAnswers = totalAnswers.length? totalAnswers[0].totalAnswers : 0;
	let start = Number(limit) * Number(offset);
	const size = Number(limit);
	start = totalAnswers <= start? 0 : start;

	let answerTags = await Question.aggregate([
		{ $unwind : "$answers" },
		{
			$group: { _id: "$tag" }
		},
		{
			$group: {
				_id: "null",
				tags: { "$push": "$_id" }
			}
		}
	]) .exec();
	answerTags = answerTags[0].tags;

	const answers = await Question.aggregate(
		[
			{ $match: query },
			{ $unwind : "$answers" },
      {
        $lookup:{
          from: "users",
          localField: "answers.answerer",
          foreignField: "_id",
          as: "answerer"
        }
      },
      {
        $lookup:{
          from: "users",
          localField: "asker",
          foreignField: "_id",
          as: "asker"
        }
      },
			{ $project : { 
				content: "$answers.content",
        credit: "$answers.credit",
				answerer: { $arrayElemAt: [ "$answerer", 0 ] },
				asker: { $arrayElemAt: [ "$asker", 0 ] },
				createdAt: "$answers.createdAt",
				"_id": 0,
				"title": 1,
				"tag": 1, 
				
      }},
      {
        $project: {
          // "answerer.password" : 0,
          // "answerer.resetPasswordToken" : 0,
          // "answerer.resetPasswordTokenExpiry" : 0,
          // "answerer.verificationToken" : 0,
          // "answerer.verificationTokenExpiry" : 0,
          // "asker.password" : 0,
          // "asker.resetPasswordToken" : 0,
          // "asker.resetPasswordTokenExpiry" : 0,
          // "asker.verificationToken" : 0,
          // "asker.verificationTokenExpiry" : 0,
        }
      },
			{ $sort : sortVariable },
			{ $skip: start },
			{ $limit : size } 
		]
  ).exec();
    console.log(answers);
	answers.forEach(( element, index ) => {
	  element.index = start + index;
	});
  
	res.status(200).json({
		err: null,
		msg: 'Answers retrieved successfully.',
		data: {
			totalAnswers,
			answerTags,
			answers,
		},
	});
};


