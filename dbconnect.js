const mongoose = require('mongoose');
const db = 'mongodb+srv://cheonguser:1234@cluster0-9bsxt.mongodb.net/test?retryWrites=true&w=majority';

mongoose
	.connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
	.then(() => {
		console.log('Connected to database');
	})
	.catch((error) => {
		console.log('Error connecting to database', error);
	});

var wordSchema = new mongoose.Schema({
	word: String,
	origin: String,
	definition: [String],
	defiTypeNum: [Number],
	defiTypeName: [String],
	synonym: [String],
	antonym: [String],
	crossReference: [String],
	sameContext: [String],
	hypernym: [String],
	example: [String]
});

var userSchema = new mongoose.Schema({
	username: String,
	email: String,
	password: String,
	favourites: [String],
	userType: String
});

const Word = mongoose.model('WordsRecord', wordSchema);

const User = mongoose.model('UserRecord', userSchema);

module.exports = {
	Word: Word,
	User: User
};
