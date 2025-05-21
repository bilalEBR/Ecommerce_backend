
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authenticateToken = require('./auth');

// Ensure the uploads directory exists
const uploadDir = 'Uploads';
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

// GET client profile (authenticated)
router.get('/client/profile/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  console.log('Received request for userId:', userId);
  console.log('Token payload (req.user):', req.user); // Debug log
  console.log('Comparing req.userId:', req.userId, 'with userId:', userId);

  if (req.userId !== userId) {
    return res.status(403).json({ message: 'Unauthorized to access this profile' });
  }

  try {
    const db = await connectToMongoDB();
    const usersCollection = db.collection('users');

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId), role: 'client' });
    if (!user) {
      return res.status(200).json({
        firstName: '',
        lastName: '',
        email: '',
        profilePicture: null,
      });
    }

    res.status(200).json({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      profilePicture: user.profilePicture || null,
    });
  } catch (error) {
    console.error('Error fetching client profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET profile for any user (no authentication, for admin use)
router.get('/admin/profiles/:userId', async (req, res) => {
  const { userId } = req.params;
  console.log('Received admin profile request for userId:', userId);

  try {
    const db = await connectToMongoDB();
    const usersCollection = db.collection('users');

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(200).json({
        firstName: '',
        lastName: '',
        email: '',
        profilePicture: null,
        role: 'unknown',
      });
    }

    res.status(200).json({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      profilePicture: user.profilePicture || null,
      role: user.role || 'user',
    });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update client profile (authenticated)
router.put('/client/profile/:userId', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  const { userId } = req.params;
  const { firstName, lastName, email } = req.body;
  const profilePicture = req.file ? `/Uploads/${req.file.filename}` : null;

  if (req.userId !== userId) {
    return res.status(403).json({ message: 'Unauthorized to update this profile' });
  }

  try {
    const db = await connectToMongoDB();
    const usersCollection = db.collection('users');

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId), role: 'client' });
    if (!user) {
      // If user doesn't exist, create a new profile entry
      const newProfile = {
        _id: new ObjectId(userId),
        role: 'client',
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || '',
        profilePicture: profilePicture || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await usersCollection.insertOne(newProfile);
      return res.status(200).json({ message: 'Profile created successfully' });
    }

    const updatedProfile = {
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email || user.email,
      profilePicture: profilePicture || user.profilePicture,
      updatedAt: new Date(),
    };

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updatedProfile }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ message: 'Profile updated successfully' });
    } else {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  } catch (error) {
    console.error('Error updating client profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;