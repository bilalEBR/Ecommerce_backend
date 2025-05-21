
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const authMiddleware = require('./auth');

router.use(express.json());
router.use(cors());

// Define the Discount schema inline
const discountSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  negotiatedPrice: { type: Number, required: true },
  chatId: { type: mongoose.Schema.Types.ObjectId, required: true },
  expiry: { type: Date, required: true },
}, { collection: 'discounts' });

const Discount = mongoose.model('Discount', discountSchema);

// Save or update a discount (seller only)
router.post('/discounts', authMiddleware, async (req, res) => {
  const { productId, userId, negotiatedPrice, chatId, expiry } = req.body;

  try {
    console.log('Received discount request:', req.body);
    console.log('Authenticated userId:', req.userId);

    // Validate authMiddleware output
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication failed: User ID not found in request' });
    }

    // Validate input
    if (!productId || !userId || !negotiatedPrice || !chatId || !expiry) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        missing: {
          productId: !productId,
          userId: !userId,
          negotiatedPrice: !negotiatedPrice,
          chatId: !chatId,
          expiry: !expiry,
        }
      });
    }

    if (!ObjectId.isValid(productId) || !ObjectId.isValid(userId) || !ObjectId.isValid(chatId)) {
      return res.status(400).json({ 
        error: 'Invalid ID format',
        invalid: {
          productId: !ObjectId.isValid(productId),
          userId: !ObjectId.isValid(userId),
          chatId: !ObjectId.isValid(chatId),
        }
      });
    }

    if (typeof negotiatedPrice !== 'number' || negotiatedPrice <= 0) {
      return res.status(400).json({ error: 'Negotiated price must be a positive number' });
    }

    const expiryDate = new Date(expiry);
    if (isNaN(expiryDate) || expiryDate <= new Date()) {
      return res.status(400).json({ error: 'Expiry date must be a valid future date' });
    }

    // Ensure database connection
    const db = await connectToMongoDB();
    const usersCollection = db.collection('users');
    const productsCollection = db.collection('products');
    const discountsCollection = db.collection('discounts');

    // Validate userId (buyer) exists
    console.log('Querying users collection for userId:', userId);
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'Buyer not found', userId });
    }
    console.log('Found buyer:', user);

    // Check if the product exists and the authenticated user is the seller
    console.log('Querying products collection for productId:', productId);
    const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found', productId });
    }
    console.log('Found product:', product);

    if (!product.sellerId) {
      return res.status(400).json({ error: 'Product document is missing sellerId', productId });
    }

    if (req.userId !== product.sellerId.toString()) {
      return res.status(403).json({ error: 'Only the seller can set discounts' });
    }

    // Check if a discount already exists for this product and user with a future expiry
    console.log('Checking for existing discount for productId:', productId, 'and userId:', userId);
    const existingDiscount = await discountsCollection.findOne({
      productId: new ObjectId(productId),
      userId: new ObjectId(userId),
      expiry: { $gt: new Date() },
    });

    let discount;
    if (existingDiscount) {
      // Update the existing discount
      console.log('Existing discount found, updating:', existingDiscount);
      const updateResult = await discountsCollection.updateOne(
        { _id: existingDiscount._id },
        {
          $set: {
            negotiatedPrice,
            expiry: expiryDate,
            chatId: new ObjectId(chatId), // Update chatId in case it has changed
          },
        }
      );
      if (updateResult.modifiedCount === 0) {
        console.log('No changes made to the existing discount');
      }
      discount = {
        _id: existingDiscount._id,
        productId: new ObjectId(productId),
        userId: new ObjectId(userId),
        negotiatedPrice,
        chatId: new ObjectId(chatId),
        expiry: expiryDate,
      };
      console.log('Discount updated:', discount);
    } else {
      // Create a new discount
      const discountData = {
        productId: new ObjectId(productId),
        userId: new ObjectId(userId),
        negotiatedPrice,
        chatId: new ObjectId(chatId),
        expiry: expiryDate,
      };
      console.log('No existing discount found, inserting new discount:', discountData);
      const result = await discountsCollection.insertOne(discountData);
      discount = { _id: result.insertedId, ...discountData };
      console.log('Discount created:', discount);
    }

    res.status(201).json(discount);
  } catch (error) {
    console.error('Error creating/updating discount:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Fetch a discount for a specific product and user (for authenticated user, e.g., buyer)
router.get('/discounts/:productId', authMiddleware, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication failed: User ID not found in request' });
    }

    // Ensure database connection
    const db = await connectToMongoDB();
    const discountsCollection = db.collection('discounts');

    console.log('Querying discounts collection for productId:', req.params.productId, 'and userId:', req.userId);
    const discount = await discountsCollection.findOne({
      productId: new ObjectId(req.params.productId),
      userId: new ObjectId(req.userId),
      expiry: { $gt: new Date() },
    });

    console.log('Fetched discount:', discount);
    res.json(discount || {});
  } catch (error) {
    console.error('Error fetching discount:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Fetch a discount for a specific product and user (for seller)
router.get('/discounts/:productId/:userId', authMiddleware, async (req, res) => {
  try {
    const { productId, userId } = req.params;

    if (!ObjectId.isValid(productId) || !ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        error: 'Invalid ID format',
        invalid: {
          productId: !ObjectId.isValid(productId),
          userId: !ObjectId.isValid(userId),
        }
      });
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication failed: User ID not found in request' });
    }

    // Ensure database connection
    const db = await connectToMongoDB();
    const productsCollection = db.collection('products');
    const discountsCollection = db.collection('discounts');

    // Check if the product exists and the authenticated user is the seller
    console.log('Querying products collection for productId:', productId);
    const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found', productId });
    }
    console.log('Found product:', product);

    if (!product.sellerId) {
      return res.status(400).json({ error: 'Product document is missing sellerId', productId });
    }

    if (req.userId !== product.sellerId.toString()) {
      return res.status(403).json({ error: 'Only the seller can view this discount' });
    }

    console.log('Querying discounts collection for productId:', productId, 'and userId:', userId);
    const discount = await discountsCollection.findOne({
      productId: new ObjectId(productId),
      userId: new ObjectId(userId),
      expiry: { $gt: new Date() },
    });

    console.log('Fetched discount:', discount);
    res.json(discount || {});
  } catch (error) {
    console.error('Error fetching discount:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Delete a discount (seller only)
router.delete('/discounts/:productId/:userId', authMiddleware, async (req, res) => {
  const { productId, userId } = req.params;

  try {
    console.log('Received delete discount request for productId:', productId, 'and userId:', userId);
    console.log('Authenticated userId:', req.userId);

    // Validate authMiddleware output
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication failed: User ID not found in request' });
    }

    // Validate input
    if (!ObjectId.isValid(productId) || !ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        error: 'Invalid ID format',
        invalid: {
          productId: !ObjectId.isValid(productId),
          userId: !ObjectId.isValid(userId),
        }
      });
    }

    // Ensure database connection
    const db = await connectToMongoDB();
    const productsCollection = db.collection('products');
    const discountsCollection = db.collection('discounts');

    // Check if the product exists and the authenticated user is the seller
    console.log('Querying products collection for productId:', productId);
    const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found', productId });
    }
    console.log('Found product:', product);

    if (!product.sellerId) {
      return res.status(400).json({ error: 'Product document is missing sellerId', productId });
    }

    if (req.userId !== product.sellerId.toString()) {
      return res.status(403).json({ error: 'Only the seller can delete discounts' });
    }

    // Check if a discount exists for this product and user with a future expiry
    console.log('Checking for existing discount for productId:', productId, 'and userId:', userId);
    const existingDiscount = await discountsCollection.findOne({
      productId: new ObjectId(productId),
      userId: new ObjectId(userId),
      expiry: { $gt: new Date() },
    });

    if (!existingDiscount) {
      return res.status(404).json({ error: 'No active discount found for this product and user' });
    }

    // Delete the discount
    console.log('Deleting discount:', existingDiscount);
    const deleteResult = await discountsCollection.deleteOne({
      _id: existingDiscount._id,
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(500).json({ error: 'Failed to delete discount' });
    }

    console.log('Discount deleted successfully');
    res.status(200).json({ message: 'Discount deleted successfully' });
  } catch (error) {
    console.error('Error deleting discount:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;