require('dotenv').config();

const { MongoClient } = require('mongodb');
 // const uri = 'mongodb://localhost:27017';

 const uri = process.env.MONGODB_URI;

const dbName = 'myDatabase';

async function connectToMongoDB() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    return client.db(dbName);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

module.exports = connectToMongoDB;