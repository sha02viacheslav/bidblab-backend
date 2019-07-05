const mongoose = require('mongoose');

const interestSchema = mongoose.Schema({
	tagName: {
		type: String,
		required: true,
		trim: true,
	},
});

mongoose.model('Interest', interestSchema);