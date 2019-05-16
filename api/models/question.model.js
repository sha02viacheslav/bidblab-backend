const mongoose = require('mongoose');

const followSchema = mongoose.Schema({
  follower: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
});

const thumbSchema = mongoose.Schema({
  thumber: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
  },
  thumbstate: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
});

const answerSchema = mongoose.Schema({
  answerer: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  thumbupcnt: {
    type: Number,
    default: 0
  },
  thumbdowncnt: {
    type: Number,
    default: 0
  },
  credit: {
    type: Number,
    default: 0
  },
  answertype: {
    type: String,
    default: 'private'
  },
  thumbs: [thumbSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
});

const questionSchema = mongoose.Schema({
  asker: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  answers: [answerSchema],
  follows: [followSchema],
  tag: {
    type: String,
    required: true,
    trim: true,
  },
  credit: {
    type: Number,
    default: 0
  },
  answerCredit: {
    type: Number,
    default: null
  },
  optionalImageCredit: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
  questionPicture: {
    url: String,
    path: String,
  },
  role: {
    type: String,
    default: "activate",
  },
});

mongoose.model('Question', questionSchema);
