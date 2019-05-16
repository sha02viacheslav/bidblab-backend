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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  role: {
    success: Boolean,
    default: false,
  },
});

mongoose.model('Invite', inviteSchema);
