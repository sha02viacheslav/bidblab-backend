const mongoose = require('mongoose');
const joi = require('joi');
const Validations = require('../utils/validations');
const config = require('../config');
const global = require('../global');
const fs = require('fs-extra');
const moment = require('moment');
const path = require('path');
const requestIp = require('request-ip');

const Question = mongoose.model('Question');
const User = mongoose.model('User');
const Report = mongoose.model('Report');
const Interest = mongoose.model('Interest');
const Credit = mongoose.model('Credit');
const Auction = mongoose.model('Auction');
const Mail = mongoose.model('Mail');
const Sitemanager = mongoose.model('Sitemanager');
const Invite = mongoose.model('Invite');

const ObjectId = mongoose.Types.ObjectId;

const removeProfileOfPrivate = (question) => {
  question.answers.forEach(element => {
    if(element.answertype == 'private'){
      element.answerer = null;
    }
  });
};

module.exports.getQuestions = async (req, res) => {
  let { offset = 0, limit = 10, search } = req.query;
  search = search.replace(/([<>*()?])/g, "\\$1");
  console.log('offset=',offset, 'limit=', limit, 'search=', search);
  const query = search
    ? {
      $or: [
        {
          title: {
            $regex: search,
            $options: 'i',
          },
        },
      ],
    }
    : {};

  const start = Number(limit) * Number(offset);
  const size = Number(limit);

  const resolvedPromises = await Promise.all([
    Question.count(query).exec(),
    Question.find(query)
      .lean()
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
      .exec(),
      
  ]);

  const count = resolvedPromises[0];
  const questions = resolvedPromises[1];

  questions.forEach(question => {
    question.answers.sort((a,b) => {
      const a_thumbupcnt = a.thumbupcnt? a.thumbupcnt : 0;
      const b_thumbupcnt = b.thumbupcnt? b.thumbupcnt : 0;
      const a_thumbdowncnt = a.thumbdowncnt? a.thumbdowncnt : 0;
      const b_thumbdowncnt = b.thumbdowncnt? b.thumbdowncnt : 0;
      const temp1 = a_thumbupcnt - a_thumbdowncnt;
      const temp2 = b_thumbupcnt - b_thumbdowncnt;
      return temp2 - temp1;
    }),
    question.answers.forEach(function(item, index) {
      if(index != 0){
        // item.remove();
      }
    })
    removeProfileOfPrivate(question);
  });


  res.status(200).json({
    err: null,
    msg: 'Questions retrieved successfully.',
    data: {
      count,
      questions,
    },
  });
};

module.exports.getQuestionsCanAnswer = async (req, res) => {
  let { offset = 0, limit = 20, search } = req.query;
  search = search.replace(/([<>*()?])/g, "\\$1");
  const query_search = search
    ? {
      $or: [
        {
          title: {
            $regex: search,
            $options: 'i',
          },
        },
        {
          tag: {
            $regex: search,
            $options: 'i',
          },
        },
      ],
    }
    : {};

  const query_userId = {
    $and: [
      {
        "answers": {
          "$not": {
            "$elemMatch": {
              "answerer": req.decodedToken.user._id
            }
          }
        }
      },
      {
        "asker": {
          "$ne": req.decodedToken.user._id
        }
      },
    ],
  };
  const resolvedPromises = await Promise.all([
    Question.count(query_search).exec(),
    Question.find(query_search).find(query_userId)
      .lean()
      .skip(+offset)
      .limit(+limit)
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
	  .exec(),
  ]);
  const count = resolvedPromises[0];
  const questions = resolvedPromises[1];
  res.status(200).json({
    err: null,
    msg: 'Questions retrieved successfully.',
    data: {
      count,
	  questions,
    },
  });
};

module.exports.getQuestionByQuestionId = async (req, res) => {
  if (!Validations.isObjectId(req.params.questionId)) {
    return res.status(422).json({
      err: null,
      msg: 'questionId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  const question = await Question.findById(req.params.questionId)
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
  
  //await question.save();
  removeProfileOfPrivate(question);

  if (!question) {
    return res
      .status(404)
      .json({ err: null, msg: 'Question not found.', data: null });
  }  
  const reports = await Question.aggregate(
    [
      { 
        $match: { 
          "_id": ObjectId(req.params.questionId) 
        }
      },
       { $unwind : "$answers" },
      { 
        $project : { 
          answerId:"$answers._id",
          "_id": 0,
        }
      },
      {
        $lookup:{
          from: "reports",
          localField: "answerId",
          foreignField: "answerId",
          as: "reports"
        }
      },
      { $unwind : "$reports" },
      { 
        $project : { 
          answerId: 1,
          reporter: "$reports.reporter",
        }
      },
    ]
  )
  .exec();
  res.status(200).json({
    err: null,
    msg: 'Question retrieved successfully.',
    data: {
      question,
      reports,
    }
  });
};

module.exports.getUserDataByuserId = async (req, res) => {
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
    msg: 'All information of this user retrieved successfully.',
    data: {
      user,
    }
  });
};

module.exports.getUserAnswerByuserId = async (req, res) => {
  if (!Validations.isObjectId(req.query.userId)) {
    return res.status(200).json({
      err: null,
      msg: 'userId parameter must be a valid ObjectId.',
      data: null,
    });
  }

  let interestFilterFlag = true;
  if(req.query.interestFilter){
    interestFilterFlag = false;
  }
  let interestArray = req.query.interestFilter.replace(/^\[|\]$/g, "").split(",");
  const resolvedPromises = await Promise.all([
    Question.count( {
      "answers": {
        "$elemMatch": {
          "answerer": req.query.userId,
          "answertype": "public",
        }
      },
      $or: [ 
        {
          "tag": { "$in": interestArray }
        },
        {
          "tag": { "$exists": interestFilterFlag }   
        }
      ]
    } ).exec(),
    Question.aggregate(
      [
        { 
          $match: { 
            "answers":  {
              "$elemMatch": {
                "answerer": ObjectId(req.query.userId),
                "answertype": "public",
              }
            }
          }
        },
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
      ]
    )
    .exec(),
    Question.aggregate(
      [
        { 
          $match: { 
            "answers":{
              "$elemMatch": {
                "answerer": ObjectId(req.query.userId),
                "answertype": "public",
              }
            },
            $or: [ 
              {
                "tag": { "$in": interestArray }
              },
              {
                "tag": { "$exists": interestFilterFlag }   
              }
            ]
          }
        },
        { $unwind : "$answers" },
        { 
          $match: { 
            "answers.answerer": ObjectId(req.query.userId)  
          }
        },
        { $project : { 
          content: "$answers.content",
          credit: "$answers.credit",
          "_id": 0,
          "title": 1,
          "tag": 1, 
        }},
      ]
    )
    .exec(),
  ]);
  const total_answers = resolvedPromises[0];
  const answerTags = resolvedPromises[1][0]? resolvedPromises[1][0].tags : [];
  const answers = resolvedPromises[2];

  res.status(200).json({
    err: null,
    msg: 'All answers of this user retrieved successfully.',
    data: {
      total_answers,
      answerTags,
      answers,
    }
  });
};

module.exports.getUserQuestionByuserId = async (req, res) => {
  if (!Validations.isObjectId(req.query.userId)) {
    return res.status(422).json({
      err: null,
      msg: 'userId parameter must be a valid ObjectId.',
      data: null,
    });
  }

  let interestFilterFlag = true;
  if(req.query.interestFilter){
    interestFilterFlag = false;
  }
  let interestArray = req.query.interestFilter.replace(/^\[|\]$/g, "").split(",");
  let resolvedPromises = await Promise.all([
    Question.count( { 
      asker: req.query.userId,
      $or: [ 
        {
          "tag": { "$in": interestArray }
        },
        {
          "tag": { "$exists": interestFilterFlag }   
        }
      ] 
    } ).exec(),
    Question.aggregate([
      { 
        $match: { 
          "asker": ObjectId(req.query.userId), 
        },
      },
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
    ]) .exec(),
    Question.aggregate([
      { 
        $match: { 
          "asker": ObjectId(req.query.userId), 
          $or: [ 
            {
              "tag": { "$in": interestArray }
            },
            {
              "tag": { "$exists": interestFilterFlag }   
            }
          ] 
        },
      },
      {
        $project: {
          "_id": 0,
          "title": 1,
          "tag": 1,
          numberOfAnswers: { $cond: { if: { $isArray: "$answers" }, then: { $size: "$answers" }, else: 0} },
          numberOfFollows: { $cond: { if: { $isArray: "$follows" }, then: { $size: "$follows" }, else: 0} }
        }
      }
    ]) .exec(),
  ]);
  const total_questions = resolvedPromises[0];
  const questionTags = resolvedPromises[1][0].tags;
  const questions = resolvedPromises[2];

  res.status(200).json({
    err: null,
    msg: 'All questiond of this user retrieved successfully.',
    data: {
      total_questions,
      questions,
      questionTags
    }
  });
};

module.exports.getQuestionsByAskerId = async (req, res) => {
  if (!Validations.isObjectId(req.decodedToken.user._id)) {
    return res.status(422).json({
      err: null,
      msg: 'askerId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  const resolvedPromises = await Promise.all([
    Question.count( { asker: req.decodedToken.user._id } ).exec(),
    Question.find( { asker: req.decodedToken.user._id } )
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
      .exec(),
  ]);
  const count = resolvedPromises[0];
  const questions = resolvedPromises[1];
  if (count == 0) {
    return res
      .status(404)
      .json({ err: null, msg: 'Question not found.', data: null });
  }
  res.status(200).json({
    err: null,
    msg: 'Questions retrieved successfully.',
    data: {
      count,
      questions,
    },
  });
};

module.exports.getMyCredits = async (req, res) => {
  if (!Validations.isObjectId(req.decodedToken.user._id)) {
    return res.status(200).json({
      err: null,
      msg: 'userId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  
  let credits = await module.exports.internalGetMyCredits(req.decodedToken.user._id);
  if(!credits){
    return res.status(200).json({
      err: null,
      msg: 'Credits was not found.',
      data: null,
    });
  }

  res.status(200).json({
    err: null,
    msg: 'Credits retrieved successfully.',
    data: {
      credits
    },
  });
};

module.exports.getQuestionsWithYourAnswers = async (req, res) => {
  if (!Validations.isObjectId(req.decodedToken.user._id)) {
    return res.status(422).json({
      err: null,
      msg: 'answererId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  const query = {
    "$or": [
      {
        "answers": {
          "$elemMatch": {
            "answerer": req.decodedToken.user._id
          }
        }
      }
    ]
  };
  const projection = {
    "answers": {
      "$elemMatch": {
        "answerer": req.decodedToken.user._id
      }
    },
    "title": 1,
    "asker": 1,
  };
  const resolvedPromises = await Promise.all([
    Question.count(query).exec(),
    Question.find(query, projection)
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
      .exec(),
  ]);
  const count = resolvedPromises[0];
  //improve in the future.
  const questionsWithYourAnswers = resolvedPromises[1];
 
  res.status(200).json({
    err: null,
    msg: 'Answers retrieved successfully.',
    data: {
      count,
      questionsWithYourAnswers,
    },
  });
};
module.exports.getQuestionsFollowing = async (req, res) => {
  if (!Validations.isObjectId(req.decodedToken.user._id)) {
    return res.status(422).json({
      err: null,
      msg: 'UserId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  const query = {
    "$or": [
      {
        "follows": {
          "$elemMatch": {
            "follower": req.decodedToken.user._id
          }
        }
      }
    ]
  };
  const projection = {
    "title": 1,
    "tag": 1,
    "questionPicture": 1,
  };

  const resolvedPromises = await Promise.all([
    Question.count(query).exec(),
    Question.find(query, projection)
      .lean()
      .exec(),
  ]);
  const count = resolvedPromises[0];
  //improve in the future.
  const questions = resolvedPromises[1];
 
  res.status(200).json({
    err: null,
    msg: 'Following quesftions retrieved successfully.',
    data: {
      count,
      questions,
    },
  });
};

module.exports.getUsersFollowing = async (req, res) => {
  if (!Validations.isObjectId(req.decodedToken.user._id)) {
    return res.status(422).json({
      err: null,
      msg: 'UserId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  const query = {
    "$or": [
      {
        "follows": {
          "$elemMatch": {
            "follower": req.decodedToken.user._id
          }
        }
      }
    ]
  };
  const projection = {
    "username": 1,
    "physicaladdress": 1,
    "physicalstate": 1,
    "profilePicture": 1,
  };

  const resolvedPromises = await Promise.all([
    User.count(query).exec(),
    User.find(query, projection)
      .lean()
      .exec(),
  ]);
  const count = resolvedPromises[0];
  //improve in the future.
  const users = resolvedPromises[1];
 
  res.status(200).json({
    err: null,
    msg: 'Following users retrieved successfully.',
    data: {
      count,
      users,
    },
  });
};

module.exports.getUserData = async (req, res) => {
  if (!Validations.isObjectId(req.decodedToken.user._id)) {
    return res.status(422).json({
      err: null,
      msg: 'UserId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  const user = await User.findById(req.decodedToken.user._id)
    .lean()
    .populate({
      path: 'follows.follower',
      select:
        '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .exec();
 
  res.status(200).json({
    err: null,
    msg: 'Following users retrieved successfully.',
    data: {
      user
    },
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
      tag: joi
        .string()
        .trim()
        .max(15)
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
  
  result.value.credit = 5;
  const defaultCredits = await Credit.findOne({ dataType: "credit"})
  .exec();
  if(defaultCredits && defaultCredits.defaultQuestionCredit){
    result.value.credit = defaultCredits.defaultQuestionCredit;
  }

  if(req.file){
    const imagePath = `${config.MEDIA_FOLDER}/questionPictures/${req.file.filename}`;
    const url = `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${
      req.headers.host}/${imagePath}`;
    result.value.questionPicture =  { path: imagePath, url: url, };
    result.value.questionPicture =  { path: imagePath, url: url, };
    result.value.optionalImageCredit = 3;
    if(defaultCredits && defaultCredits.defaultOptionalImageCredit){
      result.value.optionalImageCredit = defaultCredits.defaultOptionalImageCredit;
    }
  }
  else{
    result.value.questionPicture = '';
    result.value.optionalImageCredit =0;
  }
  
  let newQuestion = await Question.create(result.value);
  newQuestion = await Question.findById(newQuestion._id)
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
  res.status(201).json({
    err: null,
    msg: 'Question was added successfully.',
    data: newQuestion,
  });
};

module.exports.addAnswer = async (req, res) => {
	if (!Validations.isObjectId(req.params.questionId)) {
		return res.status(200).json({
		err: 'questionId parameter must be a valid ObjectId.',
		msg: null,
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
		return res.status(200).json({
		msg: result.error.details[0].message,
		err: null,
		data: null,
		});
	}
	const question = await Question.findById(req.params.questionId).exec();
	if (!question) {
		return res
		.status(200)
		.json({ err: null, msg: 'Question not found.', data: null });
	}
	if (question.asker && question.asker == req.decodedToken.user._id) {
		return res.status(200).json({
		err: null,
		msg: 'You can not answer a question you asked.',
		data: null,
		});
	}
	const alreadyAnswered = question.answers.some(
		answer => answer.answerer == req.decodedToken.user._id,
	);
	if (alreadyAnswered && !req.decodedToken.admin) {
		return res.status(200).json({
		err: null,
		msg: 'You have already answered this question.',
		data: null,
		});
	}
	result.value.answerer = req.decodedToken.admin
		? null
		: req.decodedToken.user._id;
  result.value.answertype = req.params.answertype;
	const defaultCredits = await Credit.findOne({ dataType: "credit"}).exec();
	if (result.value.answertype == 'public') {
    if(question.answerCredit){
      result.value.credit = question.answerCredit;
    }
		else if (defaultCredits && defaultCredits.defaultPublicAnswerCredit) {
			result.value.credit = defaultCredits.defaultPublicAnswerCredit;
		} else {
			result.value.credit = 8;
		}
	} else {
    if(question.answerCredit){
      result.value.credit = Math.round(question.answerCredit / 2);
    }
		else if (defaultCredits && defaultCredits.defaultPrivateAnswerCredit) {
			result.value.credit = defaultCredits.defaultPrivateAnswerCredit;
		} else {
			result.value.credit = 4;
		}
	}
  
	let answer = question.answers.create(result.value);
	question.answers.push(answer);
	await question.save();
	if (!req.decodedToken.admin) {
		answer = answer.toObject();
		answer.answerer = req.decodedToken.user;
	}
	res.status(200).json({
		err: null,
		msg: 'Answer was added successfully.',
		data: answer,
	});
};

module.exports.changeQuestionPicture = async (req, res) => {
  if (!req.file || !req.body.questionId) {
    return res.status(422).json({
      err: null,
      msg:
        'Image upload has encountered an error, supported image types are: png, jpeg, gif.',
      data: null,
    });
  }
  
  const imagePath = `${config.MEDIA_FOLDER}/questionPictures/${req.file.filename}`;
  const url = `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${
    req.headers.host}/${imagePath}`;

  const question = await Question.findByIdAndUpdate(req.body.questionId, {
    $set: {
      questionPicture: {
        path: imagePath,
        url: url,
      },
    },
  })
  .lean()
  .exec();

  if (!question) {
    return res
      .status(404)
      .json({ err: null, msg: 'Account not found.', data: null });
  }
  if (question.questionPicture) {
    await fs.remove(path.resolve('./', question.questionPicture.path));
  }
  const newQuestion = await Question.findById(question._id).lean()
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

  if(newQuestion && newQuestion.questionPicture){
    res.status(200).json({
      err: null,
      msg: 'Question Picture was changed successfully.',
      data: newQuestion,
    });
  }
  else{
    return res
      .status(404)
      .json({ err: null, msg: 'Add question picture error.', data: null });
  }
};

module.exports.addFollow = async (req, res) => {
  if (!Validations.isObjectId(req.params.objectId)) {
    return res.status(422).json({
      err: null,
      msg: 'Id parameter must be a valid ObjectId.',
      data: null,
    });
  }
  if(req.params.followType == 'user'){
    if (req.decodedToken.user._id && req.decodedToken.user._id == req.params.objectId) {
      return res.status(403).json({
        err: null,
        msg: 'You can not follow you.',
        data: null,
      });
    }
    const user = await User.findById(req.params.objectId).exec();
    if (!user) {
      return res
        .status(404)
        .json({ err: null, msg: 'User not found.', data: null });
    }
    const alreadyFollowed = user.follows.some(
      follow => follow.follower == req.decodedToken.user._id,
    );
    if (alreadyFollowed) {
      return res.status(403).json({
        err: null,
        msg: 'You have already followed this user.',
        data: null,
      });
    }
    const temp = {
      follower: req.decodedToken.user._id,
    }
    let follow = user.follows.create(temp);
    user.follows.push(follow);
    await user.save();

    const newUser = await User.findById(ObjectId(req.params.objectId))
        .lean()
        .populate({
          path: 'follows.follower',
          select:
            '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
        })
        .exec();

    if (!newUser) {
      return res
        .status(404)
        .json({ err: null, msg: 'Follow was not add.', data: null });
    }
    res.status(200).json({
      err: null,
      msg: 'Follow was added successfully.',
      data: newUser,
    });
  }
  else if(req.params.followType == 'question'){
    const question = await Question.findById(req.params.objectId).exec();
    if (!question) {
      return res
        .status(404)
        .json({ err: null, msg: 'Question not found.', data: null });
    }
    if (req.decodedToken.user._id && req.decodedToken.user._id === question.asker._id) {
      return res.status(403).json({
        err: null,
        msg: 'You can not follow your question.',
        data: null,
      });
    }
    const alreadyFollowed = question.follows.some(
      follow => follow.follower == req.decodedToken.user._id,
    );
    if (alreadyFollowed) {
      return res.status(403).json({
        err: null,
        msg: 'You have already followed this question.',
        data: null,
      });
    }
    const temp = {
      follower: req.decodedToken.user._id,
    }
    let follow = question.follows.create(temp);
    question.follows.push(follow);
    await question.save();

    const newQuestion = await Question.findById(req.params.objectId)
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
        .populate({
          path: 'follows.follower',
          select:
            '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
        })
        .exec();

    if (!newQuestion) {
      return res
        .status(404)
        .json({ err: null, msg: 'Follow was not add.', data: null });
    }
    res.status(200).json({
      err: null,
      msg: 'Follow was added successfully.',
      data: newQuestion,
    });
  }
  else{
    return res.status(422).json({
      err: null,
      msg: 'Follow type parameter must be a valid.',
      data: null,
    });
  }
}

module.exports.deleteFollow = async (req, res) => {
  if (!Validations.isObjectId(req.params.objectId)) {
    return res.status(422).json({
      err: null,
      msg: 'Id parameter must be a valid ObjectId.',
      data: null,
    });
  }

  if(req.params.followType == 'user'){
    const user = await User.findById(req.params.objectId).exec();
    if (!user) {
      return res
        .status(404)
        .json({ err: null, msg: 'User not found.', data: null });
    }

    const follow = user.follows.find(
      follow => follow.follower == req.decodedToken.user._id,
    );
    if (!follow) {
      return res
        .status(404)
        .json({ err: null, msg: 'Follow not found.', data: null });
    }
    follow.remove();
    await user.save();

    res.status(200).json({
      err: null,
      msg: 'Follow was deleted successfully.',
      data: user,
    });
  }
  else if(req.params.followType == 'question'){
    const question = await Question.findById(req.params.objectId).exec();
    if (!question) {
      return res
        .status(404)
        .json({ err: null, msg: 'Question not found.', data: null });
    }

    const follow = question.follows.find(
      follow => follow.follower == req.decodedToken.user._id,
    );
    if (!follow) {
      return res
        .status(404)
        .json({ err: null, msg: 'Follow not found.', data: null });
    }
    follow.remove();
    await question.save();

    res.status(200).json({
      err: null,
      msg: 'Follow was deleted successfully.',
      data: question,
    });
  }
  else{
    return res.status(422).json({
      err: null,
      msg: 'Follow type parameter must be a valid.',
      data: null,
    });
  }
}

module.exports.addThumb = async (req, res) => {
  if (!Validations.isObjectId(req.params.questionId)) {
    return res.status(422).json({
      err: null,
      msg: 'questionId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  if (!Validations.isObjectId(req.params.answerId)) {
    return res.status(422).json({
      err: null,
      msg: 'answerId parameter must be a valid ObjectId.',
      data: null,
    });
  }

  const question = await Question.findById(req.params.questionId).exec();
  if (!question) {
    return res
      .status(404)
      .json({ err: null, msg: 'Question not found.', data: null });
  }
  if (req.decodedToken.user._id && req.decodedToken.user._id == question.asker._id) {
    return res.status(403).json({
      err: null,
      msg: 'You can not thumb your question.',
      data: null,
    });
  }
  const answer = question.answers.id(req.params.answerId);
  if (!answer) {
    return res
      .status(404)
      .json({ err: null, msg: 'Answer not found.', data: null });
  }
  if (req.decodedToken.user._id && req.decodedToken.user._id == answer.answerer._id) {
    return res.status(403).json({
      err: null,
      msg: 'You can not thumb your answer.',
      data: null,
    });
  }
  if(!answer.thumbupcnt){
    answer.thumbupcnt = 0;
  }
  if(!answer.thumbdowncnt){
    answer.thumbdowncnt = 0;
  }
  const alreadyThumbed = answer.thumbs.find(
    thumb => thumb.thumber == req.decodedToken.user._id,
  );
  if (alreadyThumbed) {
    if(alreadyThumbed.thumbstate == req.params.thumbType){
      if(req.params.thumbType == 1){
        answer.thumbupcnt = answer.thumbupcnt - 1;
      }
      if(req.params.thumbType == 2){
        answer.thumbdowncnt = answer.thumbdowncnt - 1;
      }
      alreadyThumbed.remove();
    }
    else{
      if(req.params.thumbType == 1){
        answer.thumbupcnt = answer.thumbupcnt + 1;
        if(alreadyThumbed.thumbstate == 2){
          answer.thumbdowncnt = answer.thumbdowncnt - 1;
        }
      }
      else if(req.params.thumbType == 2){
        answer.thumbdowncnt = answer.thumbdowncnt + 1;
        if(alreadyThumbed.thumbstate == 1){
          answer.thumbupcnt = answer.thumbupcnt - 1;
        }
      }
      alreadyThumbed.thumbstate = req.params.thumbType;
    }
  }
  else{
    const currentThumbed = {
      thumber: req.decodedToken.user._id,
      thumbstate: req.params.thumbType,
    }
    if(req.params.thumbType == 1){
      answer.thumbupcnt = answer.thumbupcnt + 1;
    }
    if(req.params.thumbType == 2){
      answer.thumbdowncnt = answer.thumbdowncnt + 1;
    }
    let thumb = answer.thumbs.create(currentThumbed);
    answer.thumbs.push(thumb);
  }

  if(answer.thumbupcnt < 0){
    answer.thumbupcnt = 0;
  }
  if(answer.thumbdowncnt < 0){
    answer.thumbdowncnt = 0;
  }
  
  await question.save();


  const newQuestion = await Question.findById(req.params.questionId)
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
    .populate({
      path: 'follows.follower',
      select:
        '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .populate({
      path: 'answers.thumbs.thumber',
      select:
        '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .exec();

    removeProfileOfPrivate(newQuestion);
  

  if (!newQuestion) {
    return res
      .status(404)
      .json({ err: null, msg: 'Thumb was not add.', data: null });
  }
  res.status(200).json({
    err: null,
    msg: 'Thumb was added successfully.',
    data: newQuestion,
  });
}

module.exports.addReport = async (req, res) => {
  if (!Validations.isObjectId(req.params.questionId)) {
    return res.status(422).json({
      err: null,
      msg: 'questionId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  if (!Validations.isObjectId(req.params.answerId)) {
    return res.status(422).json({
      err: null,
      msg: 'answerId parameter must be a valid ObjectId.',
      data: null,
    });
  }

  const schema = joi
    .object({
      reportType: joi
        .string()
        .trim()
        .max(20)
        .required(),
      reportNote: joi
        .string()
        .trim()
        .max(50)
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

  let report = await Report.findOne({
      questionId: req.params.questionId,
      answerId: req.params.answerId,
      reporter: req.decodedToken.user._id,
    })
  .lean()
  .exec();
  if (report) {
    if(report.reportType == req.params.reportType && report.reportNote == req.params.reportNote){
      return res.status(403).json({
        err: null,
        msg: 'Report already exists, try a different format or rephrasing.',
        data: null,
      });
    }
    else{
      report.reportType = req.params.reportType;
      report.reportNote = req.params.reportNote;
      report.updatedAt = moment().toDate();
      await report.save();
    }
  }
  else{
    result.value.questionId = req.params.questionId;
    result.value.answerId = req.params.answerId;
    result.value.reporter = req.decodedToken.user._id;
    result.value.updatedAt = moment().toDate();
    report = await Report.create(result.value);
  }
  newReport = await Report.findById(report._id)
    .lean()
    .exec(); 
  if (!newReport) {
    return res
      .status(404)
      .json({ err: null, msg: 'Report was not add.', data: null });
  }
  res.status(200).json({
    err: null,
    msg: 'Report was added successfully.',
    data: newReport,
  });
}


module.exports.getStandardInterests  = async (req, res) => {
  const standardInterests = await Interest.aggregate(
    [
      {
        $group:
          {
            _id: null,
            interests: { $addToSet: "$interestName" }
          }
      }
    ]
  )
  .exec();
  if (!standardInterests) {
    return res
      .status(404)
      .json({ err: null, msg: 'StandardInterests was not found.', data: null });
  }

  res.status(200).json({
    err: null,
    msg: 'StandardInterests was found successfully.',
    data: standardInterests[0].interests,
  });
}

module.exports.getDefaultCredits  = async (req, res) => {
	const defaultCredits = await Credit.findOne({ dataType: "credit"}).exec();
	if (!defaultCredits) {
		res.status(200).json({
			err: null,
			msg: 'DefaultCredits was not found.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'DefaultCredits was found successfully.',
		data: defaultCredits,
	});
}

module.exports.getAuctions = async (req, res) => {
  global.changeAuctionRole();
  let { offset = 0, limit = 10, search, auctionType = 0 } = req.query;
  search = search.replace(/([<>*()?])/g, "\\$1");
  const query = {
    role: auctionType
  };
  const start = Number(limit) * Number(offset);
  const size = Number(limit);
  
  const totalAuctionsCount = await Auction.count(query).exec();
  const auctions = await  Auction.find(query)
    .lean()
    .skip(start)
    .limit(size)
    .populate({
      path: 'auctioner',
      select:
      '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .populate({
      path: 'bids.bidder',
      select:
      '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .exec();

  for( var key in auctions){
    auctions[key].bids = [];
  }
  
	res.status(200).json({
	  err: null,
	  msg: 'Auctions retrieved successfully.',
	  data: {
      totalAuctionsCount,
      auctions,
	  },
	});
};

module.exports.getAuctionsAfterLogin = async (req, res) => {
  global.changeAuctionRole();
  let { offset = 0, limit = 10, search, auctionType = 0 } = req.query;
  search = search.replace(/([<>*()?])/g, "\\$1");
  const query = {
    role: auctionType
  };
  const start = Number(limit) * Number(offset);
  const size = Number(limit);

  const totalAuctionsCount = await Auction.count(query).exec();
  const auctions = await  Auction.find(query)
    .lean()
    .skip(start)
    .limit(size)
    .populate({
      path: 'auctioner',
      select:
      '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .populate({
      path: 'bids.bidder',
      select:
      '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .exec();

  for( var key in auctions){
    auctions[key] = await module.exports.checkBids(auctions[key]);
    if(auctions[key].role != global.data().auctionRole.closed){
      auctions[key] = await module.exports.removeOtherBids(req.decodedToken.user._id, auctions[key]);
    }
  }
  
	res.status(200).json({
	  err: null,
	  msg: 'Auctions retrieved successfully.',
	  data: {
      totalAuctionsCount,
      auctions,
	  },
	});
};

module.exports.getBiddingAuctions = async (req, res) => {
  global.changeAuctionRole();
  let { offset = 0, limit = 10, search, auctionType = 0 } = req.query;
  search = search.replace(/([<>*()?])/g, "\\$1");
  const start = Number(limit) * Number(offset);
  const size = Number(limit);

  const query = {
    $and: [
      {
        "bids": {
          "$elemMatch": {
            "bidder": req.decodedToken.user._id
          }
        }
      },
      {
        role: auctionType
      },
    ],
  };
  
  const totalAuctionsCount = await Auction.count(query).exec();
  const auctions = await  Auction.find(query)
    .lean()
    .skip(start)
    .limit(size)
    .populate({
      path: 'auctioner',
      select:
      '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .populate({
      path: 'bids.bidder',
      select:
      '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .exec();

  for( var key in auctions){
    auctions[key] = await module.exports.checkBids(auctions[key]);
    if(auctions[key].role != global.data().auctionRole.closed){
      auctions[key] = await module.exports.removeOtherBids(req.decodedToken.user._id, auctions[key]);
    }
  }
  
	res.status(200).json({
	  err: null,
	  msg: 'Auctions retrieved successfully.',
	  data: {
      totalAuctionsCount,
      auctions,
	  },
	});
};

module.exports.getAuctionById = async (req, res) => {
  global.changeAuctionRole();

  if (!Validations.isObjectId(req.params.auctionId)) {
    return res.status(422).json({
      err: null,
      msg: 'AuctionId parameter must be a valid ObjectId.',
      data: null,
    });
  }
 
  let auction = await  Auction.findById(req.params.auctionId)
    .lean()
    .populate({
      path: 'auctioner',
      select:
      '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .populate({
      path: 'bids.bidder',
      select:
      '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .exec();

  auction = await module.exports.checkBids(auction);
  if(auction.role != global.data().auctionRole.closed){
    auction = await module.exports.removeOtherBids(req.decodedToken.user._id, auction);
  }
  
	res.status(200).json({
	  err: null,
	  msg: 'Auction retrieved successfully.',
	  data: {
      auction
	  },
	});
};

module.exports.checkBids = async (auction) => {

  let tempBids = auction.bids;
  let maxUniqueBid = '';
  for (index = auction.bids.length - 1; index >= 0; index--) {
    auction.bids[index].bidStatus = 0;
    if(tempBids.some( item => item.bidPrice == auction.bids[index].bidPrice && item._id != auction.bids[index]._id)){
      auction.bids[index].bidStatus = 1<<0;
    }
    else{
      // uniqueBids.push(auction.auction.bids[index]);
      if(!maxUniqueBid || maxUniqueBid.bidPrice < auction.bids[index].bidPrice){
        maxUniqueBid = auction.bids[index];
      }
    }
  }
  auction.maxUniqueBid = maxUniqueBid.bidder;
  if(maxUniqueBid){
    let temp = auction.bids.find( item => item._id == maxUniqueBid._id);
    temp.bidStatus |= 1<<1;
  }

  return auction;

}

module.exports.removeOtherBids = async (userId, auction) => {

  // for (index = auction.bids.length - 1; index >= 0; index--) {
  //   if(userId == auction.bids[index].bidder._id){
  //     auction.bids[index].remove();
  //   }
  // }

  var tempBids = [];
  auction.bids.forEach(function(item, index) {
    if(userId == item.bidder._id){
      tempBids.push(item);
    }
  })
  auction.bids = tempBids;
  return auction;
}

module.exports.addBid = async (req, res) => {
  if (!Validations.isObjectId(req.params.auctionId)) {
    return res.status(200).json({
      err: 'AuctionId parameter must be a valid ObjectId.',
      msg: null,
      data: null,
    });
  }


  const clientIp = requestIp.getClientIp(req); 
  console.log('clientIp=', clientIp);

  const schema = joi
    .object({
      bidPrice: joi
        .number()
        .max(500)
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
  const auction = await Auction.findById(req.params.auctionId).exec();
  if (!auction) {
    return res
    .status(200)
    .json({ err: null, msg: 'Auction was not found.', data: null });
  }

  if (auction.closes < new Date()) {
    return res.status(200).json({
      err: null,
      msg: 'This auction is colosed.',
      data: null,
    });
  }

  let credits = await module.exports.internalGetMyCredits(req, res);
  if (auction.bidFee > credits.answerCredits + credits.questionCredits + credits.referalCredits - credits.loseCredits) {
    return res.status(200).json({
      err: null,
      msg: 'You need more BidBlab Credits to continue bidding!',
      data: null,
    });
  }

  if (auction.bids.some(element => element.bidder == req.decodedToken.user._id && element.bidPrice == req.body.bidPrice)) {
    return res.status(200).json({
      err: null,
      msg: 'You have already bid this bid price.',
      data: null,
    });
  }

  result.value.bidder = req.decodedToken.admin
    ? null
    : req.decodedToken.user._id;
  result.value.clientIp = clientIp;
  let bid = auction.bids.create(result.value);
  auction.bids.push(bid);
  await auction.save();
  if (!req.decodedToken.admin) {
    auction.bids = auction.bids.toObject();
    auction.bids.bidder = req.decodedToken.user;
  }
  res.status(200).json({
    err: null,
    msg: 'Bid was added successfully.',
    data: {
      auction
    }
  });

};

module.exports.internalGetMyCredits = async (userId) => {

  if (!Validations.isObjectId(userId)) {
    return data = { };
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
  if(question && question[0] && question[0].questionCredits){
    questionCredits = question[0].questionCredits;
  }
  let optionalImageCredits = 0;
  if(question && question[0] && question[0].optionalImageCredits){
    optionalImageCredits = question[0].optionalImageCredits;
  }
  
  question = await Question.aggregate(
    [
      { 
        $match: { 
          "answers":{
            "$elemMatch": {
              "answerer": ObjectId(userId)
            }
          }   
        }
      },
      { $unwind : "$answers" },
      { 
        $match: { "answers.answerer": ObjectId(userId) }
      },
      { $project : { "answers" : 1, "_id": 0 } },
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
  if(question && question[0] && question[0].answerCredits){
    answerCredits = question[0].answerCredits;
  }

  const user = await User.findById(userId).exec();
  const invite = await Invite.aggregate(
    [
      { 
        $match: {
          $or: [
            {"referrer": ObjectId(userId)},
            {"friendEmail": user.email},
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
  if(invite && invite[0] && invite[0].referalCredits){
    referalCredits = invite[0].referalCredits;
  }

  let auction = await Auction.aggregate(
    [
      { 
        $match: { 
          "bids":{
            "$elemMatch": {
              "bidder": ObjectId(userId)
            }
          }   
        }
      },
      { $unwind : "$bids" },
      { 
        $match: { 
          "bids.bidder": ObjectId(userId)  
        }
      },
      { $project : { "bids" : 1, "bidFee" : 1, "_id": 0 } },
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
  if(auction){
    if(auction[0]){
      if(auction[0].loseCredits){
        loseCredits = auction[0].loseCredits;
      }
    }
  }

  return data = {
    questionCredits,
    optionalImageCredits,
    answerCredits,
    referalCredits,
    loseCredits,
  };

}

module.exports.getAboutPageContent  = async (req, res) => {
	const sitemanagers = await Sitemanager.find({ pageType: 'about'})
  .exec();
  
	if (!sitemanagers.length) {
		return res.status(200).json({
			err: null,
			msg: 'Site manager was not found.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Site manager was found successfully.',
		data: sitemanagers[0],
	});
}

module.exports.getHowPageContent  = async (req, res) => {
	const sitemanagers = await Sitemanager.find({ pageType: 'how'}).exec();
  
	if (!sitemanagers.length) {
		return res.status(200).json({
			err: null,
			msg: 'Site manager was not found.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Site manager was found successfully.',
		data: sitemanagers[0],
	});
}

module.exports.getTermsPageContent  = async (req, res) => {
	const sitemanagers = await Sitemanager.find({ pageType: 'terms'}).exec();
  
	if (!sitemanagers.length) {
		return res.status(200).json({
			err: null,
			msg: 'Site manager was not found.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Site manager was found successfully.',
		data: sitemanagers[0],
	});
}

module.exports.getCookiePageContent  = async (req, res) => {
	const sitemanagers = await Sitemanager.find({ pageType: 'cookie'}).exec();
  
	if (!sitemanagers.length) {
		return res.status(200).json({
			err: null,
			msg: 'Site manager was not found.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Site manager was found successfully.',
		data: sitemanagers[0],
	});
}

module.exports.getPrivacyPageContent  = async (req, res) => {
	const sitemanagers = await Sitemanager.find({ pageType: 'privacy'}).exec();
  
	if (!sitemanagers.length) {
		return res.status(200).json({
			err: null,
			msg: 'Site manager was not found.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Site manager was found successfully.',
		data: sitemanagers[0],
	});
}

module.exports.getInvestorPageContent  = async (req, res) => {
	const sitemanagers = await Sitemanager.find({ pageType: 'investor'}).exec();
  
	if (!sitemanagers.length) {
		return res.status(200).json({
			err: null,
			msg: 'Site manager was not found.',
			data: null,
		});
	}

	res.status(200).json({
		err: null,
		msg: 'Site manager was found successfully.',
		data: sitemanagers[0],
	});
}

module.exports.getMails = async (req, res) => {
  let { offset = 0, limit = 10, search, type = 0, active, direction } = req.query;
  search = search.replace(/([<>*()?])/g, "\\$1");

  console.log(global.data().mailRole);
  const query = 
    {
      $and: [
        search?
        {
          message: {
            $regex: search,
            $options: 'i',
          },
        }: {},
        {
          $or: [
            type & (global.data().mailRole.inbox)? {
              role: global.data().mailRole.sent,
              sender: null,
              "recievers": {
                "$elemMatch": { reciever: ObjectId(req.decodedToken.user._id) }
              },
            }: { _id: null},
            type & (global.data().mailRole.sent)? {
              role: global.data().mailRole.sent,
              sender: req.decodedToken.user._id,
            }: { _id: null},
            // type & (global.data().mailRole.archived)? {
            //   role: global.data().mailRole.archived,
            //   sender: req.decodedToken.user._id,
            // }: { _id: null},
          ]
        }
      ],
    };

  var sortVariable = {};
  if(direction == 'asc'){
    sortVariable[active] = 1;
  }
  else if(direction == 'desc'){
    sortVariable[active] = -1;
  }
  else{
    sortVariable['createdAt'] = -1;
  }
  let start = Number(limit) * Number(offset);
  const size = Number(limit);

  const totalMails = await  Mail.count(query).exec();
  if(totalMails <= start){
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
      path: 'recievers',
      select:
        '-password -verified -resetPasswordToken -resetPasswordTokenExpiry -verificationToken -verificationTokenExpiry',
    })
    .exec();
      
  mails.forEach(( element, index ) => {
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

  result.value.sender = req.decodedToken.user._id;
  result.value.subject = req.body.subject.trim();
  result.value.message = req.body.message.trim();
  result.value.role = global.data().mailRole.sent;
  result.value.recievers = null;
  const newMail = await Mail.create(result.value);

  res.status(200).json({
    err: null,
    msg: 'Message was sent successfully.',
    data: "succes"
  });
};

module.exports.archiveMessage = async (req, res) => {
  
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

  result.value.sender = req.decodedToken.user._id;
  result.value.subject = req.body.subject.trim();
  result.value.message = req.body.message.trim();
  result.value.role = global.data().mailRole.archived;
  result.value.recievers = null;
  const newMail = await Mail.create(result.value);

  res.status(200).json({
    err: null,
    msg: 'Message was archived successfully.',
    data: "succes"
  });
};

module.exports.applyRoleOfMails = async (req, res) => {
  
  const mails = await Mail.find({"_id": { "$in": req.body }}).exec();
  for(var index in mails) {
    if(mails[index].sender){
      mails[index].role = global.data().mailRole.trash;
    }
    await mails[index].save();
  }

  res.status(200).json({
    err: null,
    msg: 'Message was archived successfully.',
    data: "succes"
  });
};

module.exports.invite = async (req, res) => {

  const referrer = await User.findById(req.decodedToken.user._id).exec();
  if (!referrer) {
    return  res.status(200).json({
      err: null,
      msg: 'Account not found.',
      data: null
    });
  }

  const schema = joi
    .object({
      friendEmail: joi
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
    return res.status(422).json({
      msg: result.error.details[0].message,
      err: null,
      data: null,
    });
  }

  let friend = await User.findOne({ email: result.value.friendEmail }).lean().exec();
  if (friend) {
    return res.status(200).json({
      err: null,
      msg: 'Your friend already sign up.',
      data: null,
    });
  }

  friend = await Invite.findOne({ friendEmail: result.value.friendEmail }).lean().exec();
  if (friend) {
    return res.status(200).json({
      err: null,
      msg: 'Your friend already invited.',
      data: null,
    });
  }

  result.value.referrer = req.decodedToken.user._id;
  const defaultCredits = await Credit.findOne({ dataType: "credit"}).exec();
  result.value.referralCredit = defaultCredits? defaultCredits.defaultReferralCredit : 10;
  const invite = await Invite.create(result.value);

  if (!invite) {
    return res.status(200).json({
      err: null,
      msg: 'Invite was not sent.',
      data: null,
    });
  }

  const mailgun = require("mailgun-js");
  const DOMAIN = 'verify.bidblab.com';
  const mg = new mailgun({apiKey: '1c483f030a25d74004bd2083d3f42585-b892f62e-b1b60d12', domain: DOMAIN});


  const data = {
    from: 'Bidblab <support@bidblab.com>',
    to: invite.friendEmail,
    subject: 'Invite',
    html: `<p>Hello, ${referrer.firstName} ${referrer.lastName} invite you to BidBlab.com, 
      please click on the following link to agree: <a href="${
      config.FRONTEND_URI
    }/extra/signup/${invite.friendEmail}">Sign up</a></p>`,
  };
  mg.messages().send(data);

  res.status(200).json({
    err: null,
    msg: 'Invite was sent successfully.',
    data: "succes"
  });
};

module.exports.squarePay = async (req, res) => {

  var request_params = req.body;
	console.log('payparam=', req.body);

	var idempotency_key = require('crypto').randomBytes(64).toString('hex');

	// Charge the customer's card
	var transactions_api = new squareConnect.TransactionsApi();
	var request_body = {
		card_nonce: request_params.nonce,
		amount_money: {
			amount: 100, // $1.00 charge
			currency: 'USD'
		},
		idempotency_key: idempotency_key
	};
	await transactions_api.charge(config.SQUARE.squareLocationId, request_body).then(function(data) {
    var json= JSON.stringify(data);
    res.status(200).json({
      err: null,
      msg: 'Payment Successful.',
      data: json
    });
	}, function(error) {
    res.status(200).json({
      err: null,
      msg: error.response.text,
      data: null
    });
	});

};