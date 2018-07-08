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
        $ne: req.decodedToken.user._id,
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
    req.decodedToken.user._id,
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

module.exports.changeProfilePicture = async (req, res) => {
  if (!req.file) {
    return res.status(422).json({
      err: null,
      msg:
        'Image upload has encountered an error, supported image types are: png, jpeg, gif.',
      data: null,
    });
  }
  const imagePath = `${config.MEDIA_FOLDER}/${
    req.decodedToken.user.username
  }/profilePictures/${req.file.filename}`;
  const url = `${req.protocol}://${req.hostname}/${imagePath}`;
  const user = await User.findByIdAndUpdate(req.decodedToken.user._id, {
    $set: {
      profilePicture: {
        path: imagePath,
        url,
      },
    },
  })
    .lean()
    .exec();
  if (!user) {
    return res
      .status(404)
      .json({ err: null, msg: 'Account not found.', data: null });
  }
  if (user.profilePicture) {
    await fs.remove(path.resolve('./', user.profilePicture.path));
  }
  res.status(200).json({
    err: null,
    msg: 'Profile Picture was changed successfully.',
    data: {
      url,
      path: imagePath,
    },
  });
};
