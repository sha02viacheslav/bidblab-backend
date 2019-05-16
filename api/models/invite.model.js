const mongoose = require('mongoose');

const inviteSchema = mongoose.Schema({
  referrer: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
  },
  friendEmail: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  referralCredit: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  success: {
    type: Boolean,
    default: false,
  },
});

mongoose.model('Invite', inviteSchema);
