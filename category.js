// routes/category.js
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');

const categoryCollection = 'categories';

// Add Category
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  try {
    const db = await connectToMongoDB();
    const result = await db.collection(categoryCollection).insertOne({ name, createdAt: new Date() });
    res.status(201).json({ message: 'Category added successfully', categoryId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Categories
router.get('/', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const categories = await db.collection(categoryCollection).find().toArray();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;