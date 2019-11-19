const axios = require('axios');
const express = require('express');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.json()); // to be able to get body of request
app.use(express.static('public')); // express server htmls files automatically

const wordnikapikey = 'j7j93chirp0hl3kfvcnj3fsdcpjd4lg017zcxdpyt2yvgzljl';

const wordnikquery = `https://api.wordnik.com/v4/word.json/`;
const googlequery = `https://mydictionaryapi.appspot.com/?define=`;

const Word = require('./dbconnect');

//function for testing purpose
async function getWordFromAPI() {
	const result = await retrieveFromAPI(wordnikquery + `relationship`, googlequery + `relationship`);
}

//function to get data from multiple API with different query, save to database if no error occurs
async function retrieveFromAPI(wquery, gquery, res) {
	axios
		.all([
			axios.get(
				wquery + `/examples?includeDuplicates=false&useCanonical=false&api_key=${wordnikapikey}`
			),
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
						word = new Word({
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

app.get('/', function(req, res) {
	res.send('Welcome to WordDict');
});

app.get('/client', (req, res) => {
	//console.log(path.join(__dirname, "public", "client.html"))
	res.sendFile(path.join(__dirname, 'public', 'client.html'));
});

//display admin.html when /admin url
app.get('/admin', (req, res) => {
	//console.log(path.join(__dirname, "public", "admin.html"))
	res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

//fetch all words from database and display
app.get('/fetchAllWord', (req, res) => {
	Word.find({})
		.then((response) => {
			res.status(200).json(response);
		})
		.catch((error) => {
			res.status(400).json(error);
		});
});

app.get('/searchWord/:word', (req, res) => {
	var wordtosearch = req.params.word;

	var pattern = '/' + wordtosearch + '/';
	//console.log(pattern);

	Word.find({ word: { $regex: eval(pattern) } })
		.then((response) => {
			//console.log('functionapi log', response);
			res.status(200).json(response);
		})
		.catch((error) => {
			res.status(400).json(error);
		});
});

app.get('/fetchWord/:id', (req, res) => {
	//console.log(req.params.id)
	Word.findOne({ _id: req.params.id })
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

	Word.findByIdAndDelete(wordDeleteID)
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

	Word.updateOne(
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

//Set port to 3000
const port = process.env.PORT || 3000;

app.listen(port, () => {
	console.log(`server listening on port ${port}`);
});
