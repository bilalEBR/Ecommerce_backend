
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const connectToMongoDB = require('./db');

const collectionName = 'users';
const sellersCollectionName = 'sellers';

router.use(express.json());
router.use(cors());

router.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password, role } = req.body;
  if (!firstName || !lastName || !email || !password || !role) {
    return res.status(400).json({ error: 'First name, last name, email, password, and role are required' });
  }
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    console.log('Signup request body:', req.body);
    console.log('Destructured role:', role);
    const existingUser = await collection.findOne({ email });
    console.log('Existing user check:', existingUser);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    const userDataToInsert = {
      firstName,
      lastName,
      email,
      password, // Store password as plain text for now
      role,
      createdAt: new Date(),
    };
    console.log('Data to insert:', userDataToInsert);
    const result = await collection.insertOne(userDataToInsert);
    res.status(201).json({ message: 'User registered successfully', userId: result.insertedId });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const db = await connectToMongoDB();
    const usersCollection = db.collection('users');
    const sellersCollection = db.collection('sellers');
    const adminCollection = db.collection('admin'); 

    // Check users collection first
    let user = await usersCollection.findOne({ email });
    let role = 'client'; // Default role for users collection

    // If not found in users, check sellers collection
    if (!user) {
      user = await sellersCollection.findOne({ email });
      role = 'seller'; // Role for sellers collection
    }

    // If not found in sellers, check admin collection
    if (!user) {
      user = await adminCollection.findOne({ email });
      role = 'admin'; // Role for admin collection
    }

    // If no user found in any collection
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare passwords directly (plain text comparison)
    if (password !== user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), role: role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );

    res.status(200).json({
      userId: user._id.toString(),
      token,
      role: role,
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const users = await collection.find().toArray();
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET users over time (for chart)
router.get('/users-over-time', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);

    const usersOverTime = await collection.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]).toArray();

    // Format the response as an array of { date: "YYYY-MM", count: number }
    const formattedData = usersOverTime.map(item => ({
      date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
      count: item.count,
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error('Error fetching users over time:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET total number of users (for summary)
router.get('/total-users', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const totalUsers = await collection.countDocuments();
    res.status(200).json({ totalUsers });
  } catch (error) {
    console.error('Error fetching total users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


















