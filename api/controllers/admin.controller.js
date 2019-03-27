const mongoose = require('mongoose');
const joi = require('joi');
const moment = require('moment');
const Validations = require('../utils/validations');
const Encryption = require('../utils/encryption');

const User = mongoose.model('User');
const Question = mongoose.model('Question');

const ObjectId = mongoose.Types.ObjectId;

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
  members.forEach(( element, index ) => {
    element.index = start + index;
  });
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


module.exports.sendMessage = async (req, res) => {
  
  const mailgun = require("mailgun-js");
  const DOMAIN = 'verify.bidblab.com';
  const mg = new mailgun({apiKey: '1c483f030a25d74004bd2083d3f42585-b892f62e-b1b60d12', domain: DOMAIN});

  const data = {
    from: 'Bidblab <support@bidblab.com>',
    to: req.body.contactFormEmail,
    subject: req.body.contactFormSubjects,
    text: req.body.contactFormMessage,
  };
  mg.messages().send(data);

  res.status(201).json({
    err: null,
    msg: 'User was created successfully.',
    data: "succes"
  });
};

