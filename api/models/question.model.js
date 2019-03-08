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
  },
  thumbdowncnt: {
    type: Number,
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
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
  questionPicture: {
    url: String,
    path: String,
  },
});

mongoose.model('Question', questionSchema);
