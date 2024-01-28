const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require("mongodb");
require('dotenv').config();
const { OpenAIEmbeddings, ChatOpenAI } = require('@langchain/openai');
const { MongoDBAtlasVectorSearch } = require('@langchain/community/vectorstores/mongodb_atlas');



// Assuming fetch is globally available or imported as needed
// const fetch = ...

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const app = express();
const port = 5001; // or any other port you prefer
const dbName = "sample_mflix";
const collectionName = "embedded_movies";
const apiKey = process.env.OPEN_AI_KEY;

app.use(bodyParser.json());

// const fetch = import('node-fetch');


async function run(queryString) {
  try {
    const queryVector = await getEmbeddings(queryString);
    await client.connect();

    // set namespace
    const database = client.db(dbName);

    const coll = database.collection(collectionName);

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
            'Authorization': `Bearer ${apiKey}`,
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


app.post('/retrieve', async (req, res) => {
  try {
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);

    const question = req.body.question;
    console.log("Displaying question:", question)
    const vectorStore = new MongoDBAtlasVectorSearch(
      new OpenAIEmbeddings({
        openAIApiKey: apiKey,
        modelName: 'text-embedding-ada-002',
        stripNewLines: true,
      }), {
      collection,
      indexName: "vector-search-tutorial",
      textKey: "plot", 
      embeddingKey: "plot_embedding",
    });

    const retriever = vectorStore.asRetriever({
      searchType: "mmr",
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });

    const retrieverOutput = await retriever.getRelevantDocuments(question);
    await client.close();
    res.json(retrieverOutput);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

app.post('/chat-response', async (req, res) => {
  try {
      const { messages } = req.body;
      const currentMessageContent = messages[messages.length - 1].content;

      if (!Array.isArray(messages)) {
        return res.status(400).send({ error: 'messages must be an array' });
    }

      // Fetch vector search results
      const vectorSearch = await fetch("http://localhost:5001/retrieve", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ question: currentMessageContent }),
        }).then(res => res.json());

      const TEMPLATE = `You are a movie enthusiast helping people answer basic questions about these movies presented. If you are unsure and the answer is not explicitly written in the documentation, say "Sorry, I don't know how to help with that."

      Context sections:
      ${JSON.stringify(vectorSearch)}

      Question: """
      ${currentMessageContent}
      """
      `;

      const llm = new ChatOpenAI({
          openAIApiKey: apiKey,
          modelName: "gpt-3.5-turbo",
          streaming: false, // Set to true if streaming is desired
      });

      // Call the ChatOpenAI model
      const response = await llm.invoke(TEMPLATE);
      
      // Send the response back
      res.json({ response });
  } catch (error) {
      console.error("Error in /chat-response:", error);
      res.status(500).send('Internal Server Error');
  }
});


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

