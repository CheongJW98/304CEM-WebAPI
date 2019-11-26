const axios = require('axios');
const express = require('express');
const path = require('path');
const app = express();
const session = require('express-session');
const router = express.Router();
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const flash = require('connect-flash');

app.set('credential', { token: '' });

app.use(bodyParser.json()); // to be able to get body of request
app.use(express.static('public')); // express server htmls files automatically

const wordnikapikey = 'j7j93chirp0hl3kfvcnj3fsdcpjd4lg017zcxdpyt2yvgzljl';

const wordnikquery = `https://api.wordnik.com/v4/word.json/`;
const googlequery = `https://mydictionaryapi.appspot.com/?define=`;

const models = require('./dbconnect');

//function for testing purpose
async function getWordFromAPI() {
	const result = await retrieveFromAPI(wordnikquery + `relationship`, googlequery + `relationship`);
}

//function to get data from multiple API with different query, save to database if no error occurs
async function retrieveFromAPI(wquery, gquery, res) {
	axios
		.all([
			axios.get(wquery + `/examples?includeDuplicates=false&useCanonical=false&api_key=${wordnikapikey}`),
			axios.get(wquery + `/relatedWords?useCanonical=false&limitPerRelationshipType=10&api_key=${wordnikapikey}`),
			axios.get(gquery)
		])
		.then(
			axios.spread((wexample, wrelated, gquery) => {
				//get data from wordnik for example
				var example = new Array();

				for (x in wexample.data.examples) {
					if (wexample.data.examples[x].hasOwnProperty('text')) {
						example.push(wexample.data.examples[x].text);
						//console.log(example);
					}
				}

				//get data from wordnik for related words
				creference = new Array();
				scontext = new Array();
				hypernym = new Array();
				antonym = new Array();

				for (x in wrelated.data) {
					if (wrelated.data[x].relationshipType === 'cross-reference') {
						creference = wrelated.data[x].words.slice();
					} else if (wrelated.data[x].relationshipType === 'same-context') {
						scontext = wrelated.data[x].words.slice();
					} else if (wrelated.data[x].relationshipType === 'hypernym') {
						hypernym = wrelated.data[x].words.slice();
					} else if (wrelated.data[x].relationshipType === 'antonym') {
						antonym = wrelated.data[x].words.slice();
					}
					//console.log("w2", w2count, x);
				}

				//get data from google
				var originArr = [];
				mean = new Array();
				syno = new Array();

				originArr.push(JSON.stringify(gquery.data[0].origin));

				var text = gquery.data[0].word;

				var container = gquery.data[0].meaning;
				var googledefiCount = 0;
				var googleTypeNum = new Array();
				var googleTypeName = new Array();

				for (var property in container) {
					if (container.hasOwnProperty(property)) {
						googledefiCount = googledefiCount + container[property].length;
						googleTypeNum.push(container[property].length);
						googleTypeName.push(property);
					}
				}

				//console.log(googleTypeName, googleTypeNum);//show array of meaning type and meaning type number
				for (var property in container) {
					if (container.hasOwnProperty(property)) {
						//console.log(container[property]);

						for (var y in container[property]) {
							var temp = container[property];

							//console.log(temp[y])

							if (temp[y].hasOwnProperty('definition')) {
								mean.push(temp[y].definition);
							}
							if (temp[y].hasOwnProperty('synonyms')) {
								syno = syno.concat(temp[y].synonyms);
							}
							--googledefiCount;
							//console.log(googledefiCount);
						}
					}

					if (googledefiCount === 0) {
						console.log('adding');
						//save to database
						word = new models.Word({
							word: text,
							origin: originArr[0],
							definition: mean,
							defiTypeNum: googleTypeNum,
							defiTypeName: googleTypeName,
							synonym: syno,
							antonym: antonym,
							crossReference: creference,
							sameContext: scontext,
							hypernym: hypernym,
							example: example
						});

						word.save()
							.then((result) => {
								//console.log(`Success: ${result}`);
								res.status(200).send(`Word successfully added`);
							})
							.catch((err) => {
								res.status(400).send(err);
							});
					}
				}
			})
		)
		.catch((error) => {
			res.status(400).send(error); //send error and trigger function in admin.html, to show error message
			//console.log('error from fetch', error);
		});
}

//auto shows to login page when clicked
app.get('/', function(req, res) {
	//res.send('Welcome to WordDict');
	res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
	//console.log(path.join(__dirname, "public", "client.html"))
	res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

//register user wwith object passed from register.html
app.post('/registerUser', (req, res) => {
	console.log('register user');

	var hash = bcrypt.hashSync(req.body.password, 10);

	user = new models.User({
		username: req.body.username,
		email: req.body.email,
		password: hash,
		favourites: req.body.favourites,
		userType: req.body.userType
	});

	user.save()
		.then((response) => {
			//res.send(`User registered Successfully`);

			res.status(200).json(response);
		})
		.catch((error) => {
			res.status(400).send(error);
		});
});

//check if email had been registered
app.get('/checkEmail/:email', (req, res) => {
	models.User.find({ email: req.params.email })
		.then((response) => {
			//res.send('Email had been registered. Try use other email.');
			res.status(200).json(response);
		})
		.catch((error) => {
			res.status(400).send(error);
		});
});

//login user, compare hashed password and 
app.post('/loginUser', async function(req, res) {
	models.User.find({ email: req.body.email })
		.then((response1) => {

			if (bcrypt.compareSync(req.body.password, response1[0].password)) {
				var user = {
					username: response1[0].username,
					email: response1[0].email,
					id: '' + response1[0]._id
				};
				
				res.status(200).send(user);
			} else {
				res.status(400).send();
			}
		})
		.catch((error) => {
			res.status(400).send(error);
		});
});

//sign token to be verified for authentication later
app.post('/signIn', (req, res) => {

	const private_key = req.body.id;
	const payload = { username: req.body.username, email: req.body.email };

	const token = jwt.sign(payload, private_key, { expiresIn: '1d' });

	res.app.settings['credential'].token = token;

	res.json({
		token: token
	});

});

//logout and set token to null
app.get('/logout', (req, res) => {
	res.app.settings['credential'].token = null;
	res.sendFile('login.html', { root: path.join(__dirname, '/public/') });
});

//load login page
app.get('/login', (req, res) => {
	//console.log(path.join(__dirname, "public", "client.html"))
	res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

//add favourites word for document with specified object id and
app.get('/addFav/:id/:word', (req, res) => {
	models.User.findOne({ _id: req.params.id })
		.then((response) => {
			console.log(req.params.word)
			console.log('favourites', response['favourites']);
			var favArr = response['favourites']

			if(!favArr.includes(req.params.word)){
				favArr.push(req.params.word)

				models.User.updateOne(
					{ _id: req.params.id },
					{
						favourites: favArr
					}
				)
				.then((response) => {
					res.send(`Updated Successfully`);
					//res.res.status(200).json(response);
				})
				.catch((error) => {
					res.status(400).send(error);
				});
			}
			else{
				res.status(400).send('Word existed in favourites')
			}
			

			//res.status(200).json(response['favourites']);
		})
		.catch((error) => {
			res.status(400).json(error);
		});
});

//remvoe favourites by updating array in database
app.post('/removeFav', (req, res) => {
	console.log(req.body.id)
	models.User.updateOne(
		{ _id: req.body.id },
		{
			favourites: req.body.favourites
		}
	)
	.then((response) => {
		//res.send(`Updated Successfully`);
		res.status(200).json('Favourites removed successfully');
	})
	.catch((error) => {
		res.status(400).send(error);
	});

})

//get all favourites word from database
app.get('/getFav/:id', (req, res) => {
	models.User.findOne({ _id: req.params.id })
		.then((response) => {
			console.log('favourites', response['favourites']);
			
			res.status(200).json(response['favourites']);
		})
		.catch((error) => {
			res.status(400).json(error);
		});
});

//show client.html if user is verified
app.get('/client/:id', ensureToken, async (req, res) => {
	
	const id = req.params.id;

	await jwt.verify(req.token, id, function(err, data) {
		if (err) {
			console.log('403 in client', err);
			res.sendFile('login.html', { root: path.join(__dirname, '/public/') });
			
		} else {
			
			res.sendFile('client.html', { root: path.join(__dirname, '/public/') });
		}
	});

});

//fetch user details with object id
app.get('/fetchUser/:id', (req, res) => {
	models.User.findOne({ _id: req.params.id })
		.then((response) => {
			var loggedUser = {
				username: response['username'],
				email: response['email'],
				userType: response['userType']
			};
			res.status(200).json(loggedUser);
		})
		.catch((error) => {
			res.status(400).json(error);
		});
});


//display admin.html when /admin url
//also validate if user is admin, if user is not admin, access prohibited
app.get('/admin/:id', ensureToken, async (req, res) => {
	models.User.findOne({ _id: req.params.id })
		.then(async (response) => {
			var loggedUser = {
				username: response['username'],
				email: response['email'],
				userType: response['userType']
			};

			const id = '' + response['_id'];

			//console.log(id)
			//console.log('token',req.token)
			if (response['userType'] === 'admin') {
				await jwt.verify(req.token, id, function(err, data) {
					if (err) {
						console.log('403 in admin', err);
						res.sendFile('login.html', { root: path.join(__dirname, '/public/') });
					} else {
						res.sendFile('admin.html', { root: path.join(__dirname, '/public/') });
					}
				});
			} else {
				res.status(400).send('You are not admin');
			}
		})
		.catch((error) => {
			res.status(400).json(error);
		});
});

//fetch all words from database and display
app.get('/fetchAllWord', (req, res) => {
	models.Word.find({})
		.then((response) => {
			res.status(200).json(response);
		})
		.catch((error) => {
			res.status(400).json(error);
		});
});

//search word from database 
app.get('/searchWord/:word', (req, res) => {
	var wordtosearch = req.params.word;

	var pattern = '/' + wordtosearch + '/';
	//console.log(pattern);

	models.Word.find({ word: { $regex: eval(pattern) } })
		.then((response) => {
			//console.log('functionapi log', response);
			res.status(200).json(response);
		})
		.catch((error) => {
			res.status(400).json(error);
		});
});

//fetch specified word details from database
app.get('/fetchWord/:id', (req, res) => {
	//console.log(req.params.id)
	models.Word.findOne({ _id: req.params.id })
		.then((response) => {
			//console.log('functionapi log', response);
			res.status(200).json(response);
		})
		.catch((error) => {
			res.status(400).json(error);
		});
});

//add word with input from user
app.get('/addWord/:word', async function(req, res) {
	const searchTerm = req.params.word;
	const result = await retrieveFromAPI(wordnikquery + searchTerm, googlequery + searchTerm, res);
});

//remove word with id
app.get('/removeWord/:id', (res, req) => {
	wordDeleteID = req.req.params.id;
	//const wordDeleteID = req.params.id;
	//console.log(wordDeleteID);

	models.Word.findByIdAndDelete(wordDeleteID)
		.then((response) => {
			res.res.send(`Deleted Successfully`);
			//res.res.status(200).json(response);
		})
		.catch((error) => {
			res.res.status(400).send(error);
		});
});

//update word function. Search according to document id and update each related fields with object fetched
app.post('/updateWord/:id', (req, res) => {
	models.Word.updateOne(
		{ _id: req.params.id },
		{
			origin: req.body.updateOrigin,
			definition: req.body.updateDefi,
			synonym: req.body.updateSynonym,
			antonym: req.body.updateAntonym,
			crossReference: req.body.updateCrossReference,
			sameContext: req.body.updateSameContext,
			hypernym: req.body.updateHypernym,
			example: req.body.updateExample
		}
	)
		.then((response) => {
			res.send(`Updated Successfully`);
			//res.res.status(200).json(response);
		})
		.catch((error) => {
			res.status(400).send(error);
		});
});

//send token to be verified when access
function ensureToken(req, res, next) {
	
	const getToken = res.app.settings['credential'].token;
	
	if (typeof getToken !== 'undefined') {
		req.token = getToken;
		next();
	} else {
		console.log('Please login to consinue');
		//console.log('ensureToken', req.params.id);
		next();
	}
}

//Set port to 3000
const port = process.env.PORT || 3000;

app.listen(port, () => {
	console.log(`server listening on port ${port}`);
});
