
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const authenticateToken = require('./auth');

router.use(express.json());
router.use(cors());

// GET client address
router.get('/client/address/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  console.log('Received request for userId:', userId);
  console.log('Token payload (req.user):', req.user);

  if (req.userId !== userId) {
    return res.status(403).json({ message: 'Unauthorized to access this address' });
  }

  try {
    const db = await connectToMongoDB();
    const addressCollection = db.collection('clientAddress');

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const address = await addressCollection.findOne({ userId });
    if (!address) {
      return res.status(200).json({
        fullName: '',
        email: '',
        phoneNumber: '',
        region: '',
        postalCode: '',
        city: '',
        latitude: null,
        longitude: null,
        addressString: ''
      });
    }

    res.status(200).json({
      fullName: address.fullName || '',
      email: address.email || '',
      phoneNumber: address.phoneNumber || '',
      region: address.region || '',
      postalCode: address.postalCode || '',
      city: address.city || '',
      latitude: address.latitude || null,
      longitude: address.longitude || null,
      addressString: address.addressString || ''
    });
  } catch (error) {
    console.error('Error fetching client address:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add or Update client address
router.put('/client/address/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { 
    fullName, 
    email, 
    phoneNumber, 
    region, 
    postalCode, 
    city,
    latitude,
    longitude,
    addressString 
  } = req.body;

  if (req.userId !== userId) {
    return res.status(403).json({ message: 'Unauthorized to update this address' });
  }

  try {
    const db = await connectToMongoDB();
    const addressCollection = db.collection('clientAddress');

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const existingAddress = await addressCollection.findOne({ userId });
    const updatedAddress = {
      userId,
      fullName: fullName || '',
      email: email || '',
      phoneNumber: phoneNumber || '',
      region: region || '',
      postalCode: postalCode || '',
      city: city || '',
      updatedAt: new Date(),
    };

    // Only add GPS data if it's provided
    if (latitude && longitude) {
      updatedAddress.latitude = latitude;
      updatedAddress.longitude = longitude;
      updatedAddress.addressString = addressString || '';
    }

    if (!existingAddress) {
      updatedAddress.createdAt = new Date();
      await addressCollection.insertOne(updatedAddress);
      return res.status(200).json({ message: 'Address created successfully' });
    }

    const result = await addressCollection.updateOne(
      { userId },
      { $set: updatedAddress }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ message: 'Address updated successfully' });
    } else {
      res.status(500).json({ message: 'Failed to update address' });
    }
  } catch (error) {
    console.error('Error updating client address:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;