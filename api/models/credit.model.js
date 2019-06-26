const mongoose = require('mongoose');

const creditSchema = mongoose.Schema({
    dataType: {
        type: String,
        required: true,
    },
    defaultQuestionCredit: {
        type: Number,
        required: true,
    },
    defaultPrivateAnswerCredit: {
        type: Number,
        required: true,
    },
    defaultPublicAnswerCredit: {
        type: Number,
        required: true,
    },
    defaultOptionalImageCredit: {
        type: Number,
        required: true,
    },
    defaultReferralCredit: {
        type: Number,
        required: true,
    },
    defaultSignupCredit: {
        type: Number,
        required: true,
    },
    defaultFirstAnswerCredit: {
        type: Number,
        required: true,
    },
  });
  
mongoose.model('Credit', creditSchema);