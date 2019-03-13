const mongoose = require('mongoose');
const joi = require('joi');
const Validations = require('../utils/validations');
const config = require('../config');
const fs = require('fs-extra');

const moment = require('moment');
const path = require('path');

const Question = mongoose.model('Question');
const User = mongoose.model('User');
const Report = mongoose.model('Report');
const Interest = mongoose.model('Interest');


const ObjectId = mongoose.Types.ObjectId;

module.exports.getQuestions = async (req, res) => {
  const { offset = 0, limit = 20, search } = req.query;
  const query = search
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
  const resolvedPromises = await Promise.all([
    Question.count(query).exec(),
    Question.find(query)
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

module.exports.getQuestionsCanAnswer = async (req, res) => {
  const { offset = 0, limit = 20, search } = req.query;
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

module.exports.getQuestion = async (req, res) => {
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
         // "_id": 0,
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

  let resolvedPromises = await Promise.all([
    Question.count( { asker: req.params.userId } ).exec(),
    Question.aggregate([
      { 
        $match: { 
          "asker": ObjectId(req.params.userId) 
        }
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
  const questions = resolvedPromises[1];

  resolvedPromises = await Promise.all([
    Question.count( {
      "answers": {
        "$elemMatch": {
          "answerer": req.params.userId
        }
      }
    } ).exec(),
    Question.aggregate(
      [
        { 
          $match: { 
            "answers":{
              "$elemMatch": {
                "answerer": ObjectId(req.params.userId)
              }
            }   
          }
        },
        { $unwind : "$answers" },
        { 
          $match: { 
            "answers.answerer": ObjectId(req.params.userId)  
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
  const answers = resolvedPromises[1];

  res.status(200).json({
    err: null,
    msg: 'All information of this user retrieved successfully.',
    data: {
      user,
      total_questions,
      questions,
      total_answers,
      answers,
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
    return res.status(422).json({
      err: null,
      msg: 'userId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  
  let question = await Question.aggregate(
    [
      { 
        $match: {
          "asker": ObjectId(req.decodedToken.user._id)   
        }
      },
      {
        $group: {
          _id: "null", 
          count: {
            $sum: "$credit"
          }
        }
      }
    ]
  )
  .exec();
  let question_credits = 0;
  if(question){
    if(question[0]){
      if(question[0].count){
        question_credits = question[0].count;
      }
    }
  }
  
  question = await Question.aggregate(
    [
      { 
        $match: { 
          "answers":{
            "$elemMatch": {
              "answerer": ObjectId(req.decodedToken.user._id)
            }
          }   
        }
      },
      { $unwind : "$answers" },
      { 
        $match: { 
          "answers.answerer": ObjectId(req.decodedToken.user._id)  
        }
      },
      { $project : { "answers" : 1, "_id": 0 } },
      {
        $group: {
          _id: "null", 
          count: {
            $sum: "$answers.credit"
          }
        }
      }
    ]
  )
  .exec();
  let answer_credits = 0;
  if(question){
    if(question[0]){
      if(question[0].count){
        answer_credits = question[0].count;
      }
    }
  }
  let referal_credits = 0;
  if(question){
    if(question[1]){
      if(question[0].count){
        referal_credits = question[0].count;
      }
    }
  }


  res.status(200).json({
    err: null,
    msg: 'Questions retrieved successfully.',
    data: {
      question_credits,
      answer_credits,
      referal_credits,
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
    return res.status(422).json({
      err: null,
      msg: 'questionId parameter must be a valid ObjectId.',
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
  if (question.asker && question.asker == req.decodedToken.user._id) {
    return res.status(403).json({
      err: null,
      msg: 'You can not answer a question you asked.',
      data: null,
    });
  }
  const alreadyAnswered = question.answers.some(
    answer => answer.answerer == req.decodedToken.user._id,
  );
  if (alreadyAnswered && !req.decodedToken.admin) {
    return res.status(403).json({
      err: null,
      msg: 'You have already answered this question.',
      data: null,
    });
  }
  result.value.answerer = req.decodedToken.admin
    ? null
    : req.decodedToken.user._id;
  result.value.answertype = req.params.answertype;
  result.value.credit = result.value.answertype == 1
    ? 8
    : 4;
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

  await answer.save();
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