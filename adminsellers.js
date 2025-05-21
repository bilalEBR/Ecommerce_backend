
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const { ObjectId } = require('mongodb');
const cors = require('cors');

const collectionName = 'sellers';

router.use(express.json());
router.use(cors());

// GET all sellers (directly from the sellers collection)
router.get('/', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    console.log('Fetching sellers from collection:', collectionName);
    const sellers = await collection.find().toArray();
    console.log('Fetched sellers:', sellers);
    res.status(200).json(sellers);
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST (create) a new seller
router.post('/', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const { firstName, lastName, email, password, role } = req.body; 

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'First name, last name, email, and password are required' });
    }

    // Check if email already exists
    const existingSeller = await collection.findOne({ email });
    if (existingSeller) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Create new seller document
    const newSeller = {
      firstName,
      lastName,
      email,
      password, 
      role: role || 'seller', 
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(newSeller);
    if (result.insertedId) {
      console.log(`Created seller with ID: ${result.insertedId}`);
      const createdSeller = await collection.findOne({ _id: result.insertedId });
      res.status(201).json(createdSeller);
    } else {
      res.status(500).json({ error: 'Failed to create seller' });
    }
  } catch (error) {
    console.error('Error creating seller:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// DELETE a seller
router.delete('/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const sellerId = req.params.id;

    if (!ObjectId.isValid(sellerId)) {
      return res.status(400).json({ error: 'Invalid seller ID format' });
    }

    const seller = await collection.findOne({ _id: new ObjectId(sellerId) });
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const result = await collection.deleteOne({ _id: new ObjectId(sellerId) });
    if (result.deletedCount === 1) {
      console.log(`Deleted seller with ID: ${sellerId}`);
      res.status(200).json({ message: 'Seller deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete seller' });
    }
  } catch (error) {
    console.error('Error deleting seller:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// PUT (update) a seller
router.put('/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const sellerId = req.params.id;
    const { firstName, lastName, email } = req.body;

    if (!ObjectId.isValid(sellerId)) {
      return res.status(400).json({ error: 'Invalid seller ID format' });
    }

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    const seller = await collection.findOne({ _id: new ObjectId(sellerId) });
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(sellerId) },
      { $set: { firstName, lastName, email, updatedAt: new Date() } }
    );

    if (result.modifiedCount === 1) {
      console.log(`Updated seller with ID: ${sellerId}`);
      const updatedSeller = await collection.findOne({ _id: new ObjectId(sellerId) });
      res.status(200).json(updatedSeller);
    } else {
      res.status(500).json({ error: 'Failed to update seller' });
    }
  } catch (error) {
    console.error('Error updating seller:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// GET sellers over time (for chart)
router.get('/sellers-over-time', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);

    const sellersOverTime = await collection.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]).toArray();

    // Format the response as an array of { date: "YYYY-MM", count: number }
    const formattedData = sellersOverTime.map(item => ({
      date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
      count: item.count,
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error('Error fetching sellers over time:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET total number of sellers (for summary)
router.get('/total-sellers', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const totalSellers = await collection.countDocuments();
    res.status(200).json({ totalSellers });
  } catch (error) {
    console.error('Error fetching total sellers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;