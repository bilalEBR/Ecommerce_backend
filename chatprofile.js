
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const authenticateToken = require('./auth');

router.use(express.json());
router.use(cors());

// Test route to confirm chatprofile.js is loaded
router.get('/test', (req, res) => {
  console.log('Test route hit');
  res.status(200).json({ message: 'Chatprofile route is working' });
});

// GET seller profile
router.get('/:sellerId', authenticateToken, async (req, res) => {
  console.log('Chatprofile route hit for sellerId:', req.params.sellerId);
  const { sellerId } = req.params;
  console.log('Token payload (req.user):', req.user);

  try {
    const db = await connectToMongoDB();
    console.log('Connected to MongoDB');
    const sellersCollection = db.collection('sellers');

    if (!ObjectId.isValid(sellerId)) {
      console.log('Invalid sellerId format:', sellerId);
      return res.status(400).json({ message: 'Invalid seller ID format' });
    }

    const seller = await sellersCollection.findOne({ _id: new ObjectId(sellerId) });
    console.log('Seller query result:', seller);

    if (!seller) {
      console.log('No seller found for sellerId:', sellerId);
      return res.status(404).json({ message: 'Seller not found' });
    }

    console.log('Returning seller profile:', seller);
    res.status(200).json({
      firstName: seller.firstName || '',
      lastName: seller.lastName || '',
      email: seller.email || '',
      profilePicture: seller.profilePicture || null,
    });
  } catch (error) {
    console.error('Error fetching seller profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET user profile
router.get('/user/:userId', authenticateToken, async (req, res) => {
  console.log('Chatprofile route hit for userId:', req.params.userId);
  const { userId } = req.params;
  console.log('Token payload (req.user):', req.user);

  try {
    const db = await connectToMongoDB();
    console.log('Connected to MongoDB');
    const usersCollection = db.collection('users');

    if (!ObjectId.isValid(userId)) {
      console.log('Invalid userId format:', userId);
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    console.log('User query result:', user);

    if (!user) {
      console.log('No user found for userId:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Returning user profile:', user);
    res.status(200).json({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      profilePicture: user.profilePicture || null,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;