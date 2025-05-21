

// adminusers.js
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db'); 
const { ObjectId } = require('mongodb'); 
const cors = require('cors');

const collectionName = 'users';

router.use(express.json());
router.use(cors());

router.get('/users', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    console.log('Fetching users from collection:', collectionName);
    const users = await collection.find().toArray();
    console.log('Fetched users:', users);
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const userId = req.params.id;

    // Validate ObjectId format
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const user = await collection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if role exists and is admin
    if (user.role && user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin users' });
    }

    const result = await collection.deleteOne({ _id: new ObjectId(userId) });
    if (result.deletedCount === 1) {
      console.log(`Deleted user with ID: ${userId}`);
      res.status(200).json({ message: 'User deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const userId = req.params.id;
    const { firstName, lastName, email } = req.body;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    const user = await collection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { firstName, lastName, email, updatedAt: new Date() } }
    );

    if (result.modifiedCount === 1) {
      console.log(`Updated user with ID: ${userId}`);
      res.status(200).json({ message: 'User updated successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update user' });
    }
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});


module.exports = router;