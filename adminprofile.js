const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db'); 
const { ObjectId } = require('mongodb'); 
const cors = require('cors');
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

const collectionName = 'admin';

// GET admin profile
router.get('/profile/:adminId', async (req, res) => {
  const { adminId } = req.params;
  try {
    const db = await connectToMongoDB();
    const usersCollection = db.collection(collectionName);
    const admin = await usersCollection.findOne({ 
      _id: new ObjectId(adminId), 
      role: 'admin' 
    });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.status(200).json(admin);
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// UPDATE admin profile
router.put('/profile/:adminId', upload.single('profilePicture'), async (req, res) => {
  const { adminId } = req.params;
  const { firstName, lastName, email } = req.body;
  const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const db = await connectToMongoDB();
    const usersCollection = db.collection(collectionName);

    const admin = await usersCollection.findOne({ 
      _id: new ObjectId(adminId), 
      role: 'admin' 
    });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const updatedProfile = {
      firstName: firstName || admin.firstName,
      lastName: lastName || admin.lastName,
      email: email || admin.email,
      profilePicture: profilePicture || admin.profilePicture,
      updatedAt: new Date(),
    };

    await usersCollection.updateOne(
      { _id: new ObjectId(adminId) },
      { $set: updatedProfile }
    );

    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;