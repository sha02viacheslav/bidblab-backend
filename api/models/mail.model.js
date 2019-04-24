const mongoose = require('mongoose');

const mailSchema = mongoose.Schema({
  sender: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
  },
  recievers: {
    type: [mongoose.SchemaTypes.ObjectId],
    ref: 'User',
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  role: {
    type: Number,
    default: 0,
  },
});

mongoose.model('Mail', mailSchema);
