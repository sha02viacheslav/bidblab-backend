const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const joi = require('joi');
const moment = require('moment');
const rand = require('rand-token');
const nodemailer = require('../config/nodemailer');
const Encryption = require('../utils/encryption');
const Validations = require('../utils/validations');
const config = require('../config');

const User = mongoose.model('User');
const Admin = mongoose.model('Admin');

module.exports.signup = async (req, res) => {
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
  result.value.verificationToken = rand.generate(32);
  result.value.verificationTokenExpiry = moment()
    .add(24, 'hours')
    .toDate();
  const newUser = await User.create(result.value);
  
  // await nodemailer.sendMail({
  //   from: config.MAILER.from,
  //   to: newUser.email,
  //   subject: 'Account Verification',
  //   html: `<p>Hello ${
  //     newUser.username
  //   }, please click on the following link to verify your account: <a href="${
  //     config.FRONTEND_URI
  //   }/#/verifyAccount/${result.value.verificationToken}">Verify</a></p>`,
  // });


  const mailgun = require("mailgun-js");
const DOMAIN = 'sandbox9a8adc4ce55f49f0b77eb0b22c554c10.mailgun.org';
const mg = new mailgun({apiKey: '4ec4f2bb04b25807208f073fd21e9511-985b58f4-83a89e91', domain: DOMAIN});


const data = {
	from: 'webmaster0429@gmail.com',
	to: 'webmaster0429@gmail.com',
	subject: 'Account Verification',
  html: `<p>Hello ${
    newUser.username
  }, please click on the following link to verify your account: <a href="${
    config.FRONTEND_URI
  }/#/verifyAccount/${result.value.verificationToken}">Verify</a></p>`,
};
mg.messages().send(data, function (error, body) {
	console.log(body);
});


  // nodemailer.sendMail({
  //   from: config.MAILER.from,
  //   to: req.body.email,
  //   subject: 'Account Verification',
  //   html: `<p>Hello ${
  //     newUser.username
  //   }, please click on the following link to verify your account: <a href="${
  //     config.FRONTEND_URI
  //   }/#/verifyAccount/${result.value.verificationToken}">Verify</a></p>`,
  // }, function (err, info) {
  //   if (err) {
  //     console.log('Error: ' + err);
  //   }
  //   else {
  //     console.log('Response: ' + info);
  //   }
  // });
 
  res.status(201).json({
    err: null,
    msg: `Welcome, ${newUser.username}, your registration was successful.`,
    data: null,
  });
};

module.exports.userLogin = async (req, res) => {
  const schema = joi
    .object({
      username: joi
        .string()
        .trim()
        .lowercase()
        .required(),
      password: joi
        .string()
        .trim()
        .required(),
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
  const user = await User.findOne({
    username: result.value.username,
  }).exec();
  if (!user) {
    return res
      .status(404)
      .json({ err: null, msg: 'Account not found.', data: null });
  }
  if (!user.verified) {
    return res
      .status(404)
      .json({ err: null, msg: 'Account not verified.', data: null });
  }
  const passwordMatches = await Encryption.comparePasswordToHash(
    result.value.password,
    user.password,
  );
  if (!passwordMatches) {
    return res
      .status(401)
      .json({ err: null, msg: 'Password is incorrect.', data: null });
  }
  const token = jwt.sign(
    {
      user: user.toObject(),
    },
    config.SECRET,
    {
      expiresIn: '24h',
    },
  );
  res.status(200).json({
    err: null,
    msg: `Welcome, ${user.username}.`,
    data: token,
  });
};

module.exports.adminLogin = async (req, res) => {
  const schema = joi
    .object({
      username: joi
        .string()
        .trim()
        .lowercase()
        .required(),
      password: joi
        .string()
        .trim()
        .required(),
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
  const admin = await Admin.findOne({
    username: result.value.username,
  }).exec();
  if (!admin) {
    return res
      .status(404)
      .json({ err: null, msg: 'Account not found.', data: null });
  }
  const passwordMatches = await Encryption.comparePasswordToHash(
    result.value.password,
    admin.password,
  );
  if (!passwordMatches) {
    return res
      .status(401)
      .json({ err: null, msg: 'Password is incorrect.', data: null });
  }
  const token = jwt.sign(
    {
      user: admin.toObject(),
      admin: true,
    },
    config.SECRET,
    {
      expiresIn: '24h',
    },
  );
  res.status(200).json({
    err: null,
    msg: `Welcome, ${admin.username}.`,
    data: token,
  });
};

module.exports.verifyAccount = async (req, res) => {
  const user = await User.findOne({
    verificationToken: req.params.verificationToken,
    verificationTokenExpiry: {
      $gt: moment().toDate(),
    },
  }).exec();
  debugger;
  if (!user) {
    return res.status(422).json({
      err: null,
      msg:
        'Verification token is invalid or has expired, you can resend the verification email and try again.',
      data: null,
    });
  }
  user.verificationToken = undefined;
  user.verificationTokenExpiry = undefined;
  user.verified = true;
  await user.save();
  res.status(200).json({
    err: null,
    msg: 'Account was verified successfully.',
    data: null,
  });
};

module.exports.forgotPassword = async (req, res) => {
  const schema = joi
    .object({
      email: joi
        .string()
        .trim()
        .lowercase()
        .email()
        .required(),
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
  const user = await User.findOne({
    email: result.value.email,
  }).exec();
  if (!user) {
    return res.status(404).json({
      err: null,
      msg: 'Email is not associated with any existing account.',
      data: null,
    });
  }
  user.resetPasswordToken = rand.generate(32);
  user.resetPasswordTokenExpiry = moment()
    .add(24, 'hours')
    .toDate();
  await user.save();
  await nodemailer.sendMail({
    from: config.MAILER.from,
    to: user.email,
    subject: 'Password Reset',
    html: `<p>Hello ${
      user.username
    }, please click on the following link to reset your account's password: <a href="${
      config.FRONTEND_URI
    }/#/resetPassword/${
      user.resetPasswordToken
    }">Reset</a><br> If you did not make the request, then ignore this email, your account will be safe.</p>`,
  });
  
  

  res.status(200).json({
    err: null,
    msg:
      'An email with further instructions on how to reset your password was sent to you, check your inbox!',
    data: null,
  });
};

module.exports.checkResetPasswordToken = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.resetPasswordToken,
    resetPasswordTokenExpiry: {
      $gt: moment().toDate(),
    },
  })
    .lean()
    .exec();
  if (!user) {
    return res.status(422).json({
      err: null,
      msg:
        'Reset password token is invalid or has expired, you can submit a forgot password request again.',
      data: null,
    });
  }
  res.status(200).json({
    err: null,
    msg: 'You can now reset your password.',
    data: user._id,
  });
};

module.exports.resetPassword = async (req, res) => {
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
  const user = await User.findOne({
    _id: req.params.userId,
    resetPasswordToken: req.params.resetPasswordToken,
    resetPasswordTokenExpiry: {
      $gt: moment().toDate(),
    },
  }).exec();
  if (!user) {
    return res
      .status(404)
      .json({ err: null, msg: 'Account not found.', data: null });
  }
  user.password = await Encryption.hashPassword(result.value.password);
  user.resetPasswordToken = undefined;
  user.resetPasswordTokenExpiry = undefined;
  await user.save();
  res
    .status(200)
    .json({ err: null, msg: 'Password was reset successfully.', data: null });
};

module.exports.changePassword = async (req, res) => {
  const schema = joi
    .object({
      currentPassword: joi
        .string()
        .trim()
        .required(),
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
  const user = await User.findById(req.decodedToken.user._id).exec();
  if (!user) {
    return res
      .status(404)
      .json({ err: null, msg: 'Account not found.', data: null });
  }
  const passwordMatches = await Encryption.comparePasswordToHash(
    result.value.currentPassword,
    user.password,
  );
  if (!passwordMatches) {
    return res
      .status(403)
      .json({ err: null, msg: 'Current password is incorrect.', data: null });
  }
  user.password = await Encryption.hashPassword(result.value.password);
  await user.save();
  res
    .status(200)
    .json({ err: null, msg: 'Password was changed successfully.', data: null });
};
