const mongoose = require('mongoose');
const joi = require('joi');
const Validations = require('../utils/validations');

const Question = mongoose.model('Question');

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

module.exports.addQuestion = async (req, res) => {
  const schema = joi
    .object({
      title: joi
        .string()
        .trim()
        .max(200)
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
