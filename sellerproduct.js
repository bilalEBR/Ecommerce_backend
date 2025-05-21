


const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

router.use(express.json());
router.use(cors());

// Fetch products for a specific seller
router.get('/seller/products/:sellerId', async (req, res) => {
  const { sellerId } = req.params;
  try {
    const db = await connectToMongoDB();
    const productsCollection = db.collection('products');
    const products = await productsCollection.find({ sellerId }).toArray();
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new product with image upload
router.post('/seller/products', upload.single('image'), async (req, res) => {
  const { title, price, description, categoryId, sellerId, quantity } = req.body;
  const image = req.file ? `/Uploads/${req.file.filename}` : null;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  try {
    const db = await connectToMongoDB();
    const productsCollection = db.collection('products');

    const newProduct = {
      title,
      price: parseFloat(price),
      description,
      category: categoryId,
      image,
      sellerId,
      quantity: parseInt(quantity),
      productStatus: 'available', // Default productStatus
      createdAt: new Date(),
    };

    const result = await productsCollection.insertOne(newProduct);
    res.setHeader('Content-Type', 'application/json');
    res.status(201).json({ message: 'Product added successfully', productId: result.insertedId });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a product
router.put('/seller/products/:productId', upload.single('image'), async (req, res) => {
  const { productId } = req.params;
  const { title, price, description, categoryId, sellerId, quantity, productStatus } = req.body;
  const image = req.file ? `/Uploads/${req.file.filename}` : req.body.image;

  try {
    const db = await connectToMongoDB();
    const productsCollection = db.collection('products');

    // Validate productId
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    // Ensure the product belongs to the seller
    const product = await productsCollection.findOne({ _id: new ObjectId(productId), sellerId });
    if (!product) {
      return res.status(403).json({ error: 'Unauthorized or product not found' });
    }

    // Validate required fields
    if (!title || !price || !description || !categoryId || !quantity || !image || !productStatus) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate productStatus
    if (!['available', 'sold'].includes(productStatus)) {
      return res.status(400).json({ error: 'Invalid product status' });
    }

    const updatedProduct = {
      title,
      price: parseFloat(price),
      description,
      category: categoryId,
      image,
      sellerId,
      quantity: parseInt(quantity, 10),
      productStatus, // Include productStatus
      updatedAt: new Date(),
    };

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(productId) },
      { $set: updatedProduct }
    );

    if (result.modifiedCount === 0) {
      return res.status(500).json({ error: 'Failed to update product' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a product
router.delete('/seller/products/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const db = await connectToMongoDB();
    const productsCollection = db.collection('products');

    const result = await productsCollection.deleteOne({ _id: new ObjectId(productId) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


