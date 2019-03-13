const mongoose = require('mongoose');

const interestSchema = mongoose.Schema({
    interestName: {
        type: String,
        required: true,
        trim: true,
    },
  });
  
mongoose.model('Interest', interestSchema);