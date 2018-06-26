const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    trim: true,
  },
  profilePicture: {
    url: String,
    path: String,
  },
  resetPasswordToken: String,
  resetPasswordTokenExpiry: Date,
  verificationToken: String,
  verificationTokenExpiry: Date,
  verified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
});

if (!userSchema.options.toObject) userSchema.options.toObject = {};

userSchema.options.toObject.transform = (doc, ret) => {
  delete ret.password;
  delete ret.resetPasswordToken;
  delete ret.resetPasswordTokenExpiry;
  delete ret.verificationToken;
  delete ret.verificationTokenExpiry;
  return ret;
};

mongoose.model('User', userSchema);
