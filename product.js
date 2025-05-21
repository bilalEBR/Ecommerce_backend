

const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const { ObjectId } = require('mongodb');

const productCollection = 'products';

// Add Product
router.post('/', async (req, res) => {
  const { name, category, imageUrl } = req.body;
  if (!name || !category || !imageUrl) {
    return res.status(400).json({ error: 'Name, category, and image URL are required' });
  }
  try {
    const db = await connectToMongoDB();
    const result = await db.collection(productCollection).insertOne({
      name,
      category,
      imageUrl,
      createdAt: new Date(),
    });
    res.status(201).json({ message: 'Product added successfully', productId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Products
router.get('/', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const products = await db.collection(productCollection).find().toArray();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET total number of products (for summary)
router.get('/total-products', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(productCollection);
    const totalProducts = await collection.countDocuments();
    res.status(200).json({ totalProducts });
  } catch (error) {
    console.error('Error fetching total products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Decrease Product Quantities
router.put('/decrease-quantities', async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Items array is required and must not be empty' });
  }

  try {
    const db = await connectToMongoDB();
    const collection = db.collection(productCollection);

    // Validate and prepare updates
    for (const item of items) {
      const { productId, quantity } = item;

      // Validate productId
      if (!productId || !ObjectId.isValid(productId)) {
        return res.status(400).json({ message: `Invalid product ID format: ${productId}` });
      }

      // Validate quantity
      if (typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ message: `Invalid quantity for product ID ${productId}: ${quantity}` });
      }

      // Convert productId to ObjectId
      const objectId = new ObjectId(productId);

      // Check if product exists
      const product = await collection.findOne({ _id: objectId });
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${productId}` });
      }

      // Update quantity
      const result = await collection.updateOne(
        { _id: objectId },
        { $inc: { quantity: -quantity } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: `Product not found during update: ${productId}` });
      }

      // Verify quantity didn't go negative
      const updatedProduct = await collection.findOne({ _id: objectId });
      if (updatedProduct.quantity < 0) {
        // Roll back the update
        await collection.updateOne(
          { _id: objectId },
          { $inc: { quantity: quantity } }
        );
        return res.status(400).json({ message: `Insufficient quantity for product ID ${productId}` });
      }

      console.log(`Decreased quantity for product ${productId} by ${quantity}. New quantity: ${updatedProduct.quantity}`);
    }

    res.status(200).json({ message: 'Product quantities updated successfully' });
  } catch (error) {
    console.error('Error decreasing product quantities:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Increase Product Quantities
router.put('/increase-quantities', async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Items array is required and must not be empty' });
  }

  try {
    const db = await connectToMongoDB();
    const collection = db.collection(productCollection);

    // Validate and prepare updates
    for (const item of items) {
      const { productId, quantity } = item;

      // Validate productId
      if (!productId || !ObjectId.isValid(productId)) {
        return res.status(400).json({ message: `Invalid product ID format: ${productId}` });
      }

      // Validate quantity
      if (typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ message: `Invalid quantity for product ID ${productId}: ${quantity}` });
      }

      // Convert productId to ObjectId
      const objectId = new ObjectId(productId);

      // Check if product exists
      const product = await collection.findOne({ _id: objectId });
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${productId}` });
      }

      // Update quantity
      const result = await collection.updateOne(
        { _id: objectId },
        { $inc: { quantity: quantity } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: `Product not found during update: ${productId}` });
      }

      const updatedProduct = await collection.findOne({ _id: objectId });
      console.log(`Increased quantity for product ${productId} by ${quantity}. New quantity: ${updatedProduct.quantity}`);
    }

    res.status(200).json({ message: 'Product quantities restored successfully' });
  } catch (error) {
    console.error('Error increasing product quantities:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;