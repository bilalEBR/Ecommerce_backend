
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const { ObjectId } = require('mongodb');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads/ directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('Created uploads/ directory');
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    cb(null, filename);
    console.log('Saving file as:', filename);
  },
});

const upload = multer({ storage: storage });

const collectionName = 'categories';

router.use(express.json());
router.use(cors());

router.get('/', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    console.log('Fetching categories from collection:', collectionName);
    const categories = await collection.find().toArray();
    console.log('Fetched categories:', categories);
    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const { name } = req.body;

    if (!name || !req.file) {
      return res.status(400).json({ error: 'Name and image are required' });
    }

    const imagePath = `/uploads/${req.file.filename}`;
    console.log('Storing image path in DB:', imagePath);
    const newCategory = { name, image: imagePath, createdAt: new Date() };
    const result = await collection.insertOne(newCategory);
    const insertedCategory = await collection.findOne({ _id: result.insertedId });

    console.log('Added category:', insertedCategory);
    res.status(201).json(insertedCategory);
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const categoryId = req.params.id;
    const { name } = req.body;

    if (!ObjectId.isValid(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID format' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const updateData = { name };
    if (req.file) {
      const imagePath = `/uploads/${req.file.filename}`;
      console.log('Updating image path in DB:', imagePath);
      updateData.image = imagePath;
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(categoryId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updatedCategory = await collection.findOne({ _id: new ObjectId(categoryId) });
    console.log('Updated category:', updatedCategory);
    res.status(200).json(updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const categoryId = req.params.id;

    if (!ObjectId.isValid(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID format' });
    }

    const result = await collection.deleteOne({ _id: new ObjectId(categoryId) });
    if (result.deletedCount === 1) {
      console.log(`Deleted category with ID: ${categoryId}`);
      res.status(200).json({ message: 'Category deleted successfully' });
    } else {
      return res.status(404).json({ error: 'Category not found' });
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

module.exports = router;
