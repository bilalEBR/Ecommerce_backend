const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const { ObjectId } = require('mongodb');
const cors = require('cors');

router.use(express.json());
router.use(cors());

const collectionName = 'adminAccount';

// GET all admin accounts
router.get('/all', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const accountsCollection = db.collection(collectionName);
    const accounts = await accountsCollection.find({}).toArray();
    res.status(200).json(accounts);
  } catch (error) {
    console.error('Error fetching admin accounts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET admin account by ID
router.get('/:accountId', async (req, res) => {
  const { accountId } = req.params;
  try {
    const db = await connectToMongoDB();
    const accountsCollection = db.collection(collectionName);
    const account = await accountsCollection.findOne({ _id: new ObjectId(accountId) });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    res.status(200).json(account);
  } catch (error) {
    console.error('Error fetching admin account:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ADD new admin account
router.post('/add', async (req, res) => {
  const { bankName, accountHolderName, accountNumber, phoneNumber, teleBirrPhoneNumber, accountStatus } = req.body;
  try {
    const db = await connectToMongoDB();
    const accountsCollection = db.collection(collectionName);

    const newAccount = {
      bankName,
      accountHolderName,
      accountNumber,
      phoneNumber,
      accountStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await accountsCollection.insertOne(newAccount);
    res.status(201).json({ message: 'Account added successfully', accountId: result.insertedId });
  } catch (error) {
    console.error('Error adding admin account:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// UPDATE admin account
router.put('/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const { bankName, accountHolderName, accountNumber, phoneNumber, teleBirrPhoneNumber, accountStatus } = req.body;
  try {
    const db = await connectToMongoDB();
    const accountsCollection = db.collection(collectionName);

    const account = await accountsCollection.findOne({ _id: new ObjectId(accountId) });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const updatedAccount = {
      bankName: bankName || account.bankName,
      accountHolderName: accountHolderName || account.accountHolderName,
      accountNumber: accountNumber || account.accountNumber,
      phoneNumber: phoneNumber || account.phoneNumber,
      // teleBirrPhoneNumber: teleBirrPhoneNumber || account.teleBirrPhoneNumber,
      accountStatus: accountStatus || account.accountStatus,
      updatedAt: new Date(),
    };

    await accountsCollection.updateOne(
      { _id: new ObjectId(accountId) },
      { $set: updatedAccount }
    );

    res.status(200).json({ message: 'Account updated successfully' });
  } catch (error) {
    console.error('Error updating admin account:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE admin account
router.delete('/:accountId', async (req, res) => {
  const { accountId } = req.params;
  try {
    const db = await connectToMongoDB();
    const accountsCollection = db.collection(collectionName);

    const result = await accountsCollection.deleteOne({ _id: new ObjectId(accountId) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Account not found' });
    }

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin account:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;