const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require("mongodb");
require('dotenv').config();

// Assuming fetch is globally available or imported as needed
// const fetch = ...

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const app = express();
const port = 5001; // or any other port you prefer

app.use(bodyParser.json());

// const fetch = import('node-fetch');


async function run(queryString) {
  try {
    const queryVector = await getEmbeddings(queryString);
    await client.connect();

    // set namespace
    const database = client.db("sample_mflix");const { EJSON } = require('mongodb');

    const coll = database.collection("embedded_movies");

    // define pipeline
    const agg = [
      {
        '$vectorSearch': {
          'index': 'vector-search-tutorial', 
          'path': 'plot_embedding', 
          'filter': {
            '$and': [
              {
                'genres': {
                  '$nin': [
                    'Drama', 'Western', 'Crime'
                  ], 
                  '$in': [
                    'Action', 'Adventure', 'Family'
                  ]
                }
              }, {
                'year': {
                  '$gte': 1960, 
                  '$lte': 2000
                }
              }
            ]
          }, 
          'queryVector': queryVector, 
          'numCandidates': 200, 
          'limit': 10
        }
      }, {
        '$project': {
          '_id': 0, 
          'title': 1, 
          'genres': 1, 
          'plot': 1, 
          'year': 1, 
          'score': {
            '$meta': 'vectorSearchScore'
          }
        }
      }
    ];

    // run pipeline
    const result = await coll.aggregate(agg).toArray();

    // Close the client connection
    await client.close();

    // Return the results
    return result;
  } finally {
    await client.close();
  }
}


async function getEmbeddings(inputString){
  const url = 'https://api.openai.com/v1/embeddings';
  try {
      // Call OpenAI API to get the embeddings.
      const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPEN_AI_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            input: inputString,
            model: "text-embedding-ada-002"
        })
    });
    
      const data = await response.json();
      console.log(data);
      const embedding = data.data[0].embedding;
      console.log(embedding)
      return embedding;

  } catch(err) {
      console.error(err);
  }
}

// const queryString = "boy meets girl";
// run(queryString).catch(console.dir);


app.post('/getResults', async (req, res) => {
  try {
      const queryString = req.body.queryString;
      if (!queryString) {
          return res.status(400).send({ error: 'queryString is required' });
      }
      
      const result = await run(queryString);
      res.json(result);
  } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});