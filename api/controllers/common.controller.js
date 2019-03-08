const mongoose = require('mongoose');
const joi = require('joi');
const Validations = require('../utils/validations');
const config = require('../config');
const fs = require('fs-extra');

const moment = require('moment');
const path = require('path');

const Question = mongoose.model('Question');
const User = mongoose.model('User');

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
          tags: {
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
          tags: {
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
              "answerer": req.query.userId
            }
          }
        }
      },
      {
        "asker": {
          "$ne": req.query.userId
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
  res.status(200).json({
    err: null,
    msg: 'Question retrieved successfully.',
    data: question,
  });
};

module.exports.getQuestionsByAskerId = async (req, res) => {
  if (!Validations.isObjectId(req.params.askerId)) {
    return res.status(422).json({
      err: null,
      msg: 'askerId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  const resolvedPromises = await Promise.all([
    Question.count( { asker: req.params.askerId } ).exec(),
    Question.find( { asker: req.params.askerId } )
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

module.exports.getQuestionsWithYourAnswers = async (req, res) => {
  if (!Validations.isObjectId(req.params.answererId)) {
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
            "answerer": req.params.answererId
          }
        }
      }
    ]
  };

  const projection = {
    "answers": {
      "$elemMatch": {
        "answerer": req.params.answererId
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
  if (count == 0) {
    return res
      .status(404)
      .json({ err: null, msg: 'Answer not found.', data: null });
  }
  res.status(200).json({
    err: null,
    msg: 'Answers retrieved successfully.',
    data: {
      count,
      questionsWithYourAnswers,
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
      tags: joi.array().items(joi.string().trim()),
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
  if (!req.decodedToken.admin) {
    newQuestion = newQuestion.toObject();
    newQuestion.asker = req.decodedToken.user;
  }
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
  const newQuestion = await Question.findById(question._id);

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
  if (!Validations.isObjectId(req.params.questionId)) {
    return res.status(422).json({
      err: null,
      msg: 'questionId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  const question = await Question.findById(req.params.questionId).exec();
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