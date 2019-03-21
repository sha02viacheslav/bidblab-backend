const mongoose = require('mongoose');
const joi = require('joi');
const moment = require('moment');
const Validations = require('../utils/validations');
const Encryption = require('../utils/encryption');

const User = mongoose.model('User');
const Question = mongoose.model('Question');

module.exports.getMembers = async (req, res) => {

  const { offset = 0, limit = 10, search } = req.query;
  const query = search
    ? {
      $or: [
        {
          username: {
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
    User.count(query).exec(),
    User.find(query)
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
  const totalMembers = resolvedPromises[0];
  const members = resolvedPromises[1];
  res.status(200).json({
    err: null,
    msg: 'Users retrieved successfully.',
    data: {
      totalMembers,
      members,
    }
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
  result.value.verified = true;
  const newUser = await User.create(result.value);
  res.status(201).json({
    err: null,
    msg: 'User was created successfully.',
    data: newUser.toObject(),
  });
};

module.exports.updateUser = async (req, res) => {
  if (!Validations.isObjectId(req.params.userId)) {
    return res.status(422).json({
      err: null,
      msg: 'userId parameter must be a valid ObjectId.',
      data: null,
    });
  }
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
        $ne: req.params.userId,
      },
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
  }
  result.value.updatedAt = moment().toDate();
  const updatedUser = await User.findByIdAndUpdate(
    req.params.userId,
    {
      $set: result.value,
    },
    {
      new: true,
    },
  ).exec();
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

module.exports.deleteUser = async (req, res) => {
  if (!Validations.isObjectId(req.params.userId)) {
    return res.status(422).json({
      err: null,
      msg: 'userId parameter must be a valid ObjectId.',
      data: null,
    });
  }
  const deletedUser = await User.findByIdAndRemove(req.params.userId)
    .lean()
    .select(
      '-password -verificationToken -verificationTokenExpiry -resetPasswordToken -resetPasswordTokenExpiry',
    )
    .exec();
  if (!deletedUser) {
    return res
      .status(404)
      .json({ err: null, msg: 'User not found.', data: null });
  }
  res.status(200).json({
    err: null,
    msg: 'User was deleted successfully.',
    data: deletedUser,
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
        .max(200),
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

