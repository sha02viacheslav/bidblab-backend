const mongoose = require('mongoose');

const reportSchema = mongoose.Schema({
	questionId: {
		type: mongoose.SchemaTypes.ObjectId,
		ref: 'Question',
	},
	answerId: {
		type: mongoose.SchemaTypes.ObjectId,
		ref: 'Answer',
	},
	reporter: {
		type: mongoose.SchemaTypes.ObjectId,
		ref: 'User',
	},
	reportType: {
		type: String,
		required: true,
		trim: true,
	},
	reportNote: {
		type: String,
		required: true,
		trim: true,
	},
	role: {
		type: String,
		default: "activate",
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: Date,
});


mongoose.model('Report', reportSchema);