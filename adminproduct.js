// adminproduct.js
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const { ObjectId } = require('mongodb');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads/ directory exists (already handled in main.js, but good to check)
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

const collectionName = 'products';

router.use(express.json());
router.use(cors());

// GET all products
router.get('/', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    console.log('Fetching products from collection:', collectionName);
    const products = await collection.find().toArray();
    console.log('Fetched products:', products);
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST a new product
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const { title, price, description, categoryId } = req.body;

    if (!title || !price || !description || !categoryId || !req.file) {
      return res.status(400).json({ error: 'Title, price, description, categoryId, and image are required' });
    }

    const imagePath = `/uploads/${req.file.filename}`;
    console.log('Storing image path in DB:', imagePath);
    const newProduct = {
      title,
      price: parseFloat(price), // Ensure price is a number
      description,
      categoryId,
      image: imagePath,
      createdAt: new Date(),
    };
    const result = await collection.insertOne(newProduct);
    const insertedProduct = await collection.findOne({ _id: result.insertedId });

    console.log('Added product:', insertedProduct);
    res.status(201).json(insertedProduct);
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// PUT (update) a product

 router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const productId = req.params.id;
    const { title, price, description, categoryId } = req.body;

    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    if (!title || !price || !description || !categoryId) {
      return res.status(400).json({ error: 'Title, price, description, and categoryId are required' });
    }

    const updateData = {
      title,
      price: parseFloat(price),
      description,
      categoryId,
    };
    if (req.file) {
      const imagePath = `/uploads/${req.file.filename}`;
      console.log('Updating image path in DB:', imagePath);
      updateData.image = imagePath;
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(productId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updatedProduct = await collection.findOne({ _id: new ObjectId(productId) });
    console.log('Updated product:', updatedProduct);
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// DELETE a product
 router.delete('/:id', async (req, res) => {

  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const productId = req.params.id;

    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    const result = await collection.deleteOne({ _id: new ObjectId(productId) });
    if (result.deletedCount === 1) {
      console.log(`Deleted product with ID: ${productId}`);
      res.status(200).json({ message: 'Product deleted successfully' });
    } else {
      return res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

module.exports = router;