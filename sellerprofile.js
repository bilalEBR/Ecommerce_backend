
// sellerprofile.js
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
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

router.use(express.json());
router.use(cors());

// GET seller profile
router.get('/seller/profile/:sellerId', async (req, res) => {
  const { sellerId } = req.params;

  try {
    const db = await connectToMongoDB();
    const sellersCollection = db.collection('sellers');

    if (!ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: 'Invalid seller ID format' });
    }

    const seller = await sellersCollection.findOne({ _id: new ObjectId(sellerId) });
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    res.status(200).json(seller);
  } catch (error) {
    console.error('Error fetching seller profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update seller profile
router.put('/seller/profile/:sellerId', upload.single('profilePicture'), async (req, res) => {
  const { sellerId } = req.params;
  const { firstName, lastName, email } = req.body;
  const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const db = await connectToMongoDB();
    const sellersCollection = db.collection('sellers');

    if (!ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: 'Invalid seller ID format' });
    }

    const seller = await sellersCollection.findOne({ _id: new ObjectId(sellerId) });
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const updatedProfile = {
      firstName: firstName || seller.firstName,
      lastName: lastName || seller.lastName,
      email: email || seller.email,
      profilePicture: profilePicture || seller.profilePicture,
      updatedAt: new Date(),
    };

    const result = await sellersCollection.updateOne(
      { _id: new ObjectId(sellerId) },
      { $set: updatedProfile }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ message: 'Profile updated successfully' });
    } else {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  } catch (error) {
    console.error('Error updating seller profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;