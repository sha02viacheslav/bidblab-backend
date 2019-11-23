const mongoose = require('mongoose');

const loginSchema = mongoose.Schema({
	userId: {
		type: mongoose.SchemaTypes.ObjectId,
		ref: 'User',
	},
	clientIp: {
		type: String,
		required: true,
		trim: true,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	}
});


mongoose.model('Login', loginSchema);