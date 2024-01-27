# What is This?
This project is just an example for using co-located embeddings & operational data on a MongoDB server. It uses the sample m_flix mongoDB data to:
1. Send an arbitrary search query for a list of movies
2. Get embeddings from OpenAI's Ada model
3. Do vector search on the movie data's plot description
4. Return the top 10 most similar items 

# Setup
1. Go through setting up an atlas instance & vector search index as described [here](https://www.mongodb.com/products/platform/atlas-vector-search)
2. Create a user + connection string and store that as ```MONGO_URI``` in .env
3. Create an Open AI API key and store it in .env as ```OPEN_AI_KEY```

# Usage
1. Run ```npm i``` to get all the necessary modules
2. Run ```node start``` to start the server
3. In a new tab, call ./example_request.sh YOUR_SEARCH_TERM_HERE
4. Within a few seconds you will get a list of movies with the closest matches to your search term

# Future Work
1. Figuring out how to run all on a local mongodb instance
2. Wrap for L402s.
3. Doing RAG
