
// const express = require('express');
// const router = express.Router();
// const { ObjectId } = require('mongodb');
// const connectToMongoDB = require('./db');

// // Test route to confirm the router is working
// router.get('/test', (req, res) => {
//   console.log('Test route hit: /change-password/test');
//   res.json({ message: 'Change password route active' });
// });

// // Single POST route for /change-password (for users)

// router.post('/', async (req, res) => {
//   console.log('Received change-password request (user):', req.body);
//   const { userId, oldPassword, newPassword } = req.body;

//   if (!userId || !oldPassword || !newPassword) {
//     console.log('Validation failed: Missing fields');
//     return res.status(400).json({ error: 'User ID, old password, and new password are required' });
//   }

//   if (!ObjectId.isValid(userId)) {
//     console.log('Validation failed: Invalid userId:', userId);
//     return res.status(400).json({ error: 'Invalid user ID format' });
//   }

//   if (newPassword.length < 6) {
//     console.log('Validation failed: New password too short');
//     return res.status(400).json({ error: 'New password must be at least 6 characters' });
//   }

//   try {
//     const db = await connectToMongoDB();
//     const usersCollection = db.collection('users');
//     const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
//     if (!user) {
//       console.log('User not found:', userId);
//       return res.status(404).json({ error: 'User not found' });
//     }

//     if (user.password !== oldPassword) {
//       console.log('Incorrect old password for user:', userId);
//       return res.status(401).json({ error: 'Incorrect old password' });
//     }

//     const result = await usersCollection.updateOne(
//       { _id: new ObjectId(userId) },
//       { $set: { password: newPassword } }
//     );

//     if (result.modifiedCount === 0) {
//       console.log('Failed to update password for user:', userId);
//       return res.status(500).json({ error: 'Failed to update password' });
//     }

//     res.status(200).json({ message: 'Password changed successfully' });
//   } catch (error) {
//     console.error('Error in change-password:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // admin password change route
// router.post('/admin', async (req, res) => {
//   console.log('Received change-password request (admin):', req.body);
//   const { adminId, oldPassword, newPassword } = req.body;

//   if (!adminId || !oldPassword || !newPassword) {
//     console.log('Validation failed: Missing fields');
//     return res.status(400).json({ error: 'Admin ID, old password, and new password are required' });
//   }

//   if (!ObjectId.isValid(adminId)) {
//     console.log('Validation failed: Invalid adminId:', adminId);
//     return res.status(400).json({ error: 'Invalid admin ID format' });
//   }

//   if (newPassword.length < 6) {
//     console.log('Validation failed: New password too short');
//     return res.status(400).json({ error: 'New password must be at least 6 characters' });
//   }

//   try {
//     const db = await connectToMongoDB();
//     const adminsCollection = db.collection('admin');
//     const admin = await adminsCollection.findOne({ _id: new ObjectId(adminId) });
//     if (!admin) {
//       console.log('Admin not found:', adminId);
//       return res.status(404).json({ error: 'Admin not found' });
//     }

//     if (admin.password !== oldPassword) {
//       console.log('Incorrect old password for admin:', adminId);
//       return res.status(401).json({ error: 'Incorrect old password' });
//     }

//     const result = await adminsCollection.updateOne(
//       { _id: new ObjectId(adminId) },
//       { $set: { password: newPassword } }
//     );

//     if (result.modifiedCount === 0) {
//       console.log('Failed to update password for admin:', adminId);
//       return res.status(500).json({ error: 'Failed to update password' });
//     }

//     res.status(200).json({ message: 'Password changed successfully' });
//   } catch (error) {
//     console.error('Error in change-password for admin:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// module.exports = router;



const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const connectToMongoDB = require('./db');


// Single POST route for /change-password (for users)
router.post('/', async (req, res) => {
  console.log('Received change-password request (user):', req.body);
  const { userId, oldPassword, newPassword } = req.body;

  if (!userId || !oldPassword || !newPassword) {
    console.log('Validation failed: Missing fields');
    return res.status(400).json({ error: 'User ID, old password, and new password are required' });
  }

  if (!ObjectId.isValid(userId)) {
    console.log('Validation failed: Invalid userId:', userId);
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  if (newPassword.length < 6) {
    console.log('Validation failed: New password too short');
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const db = await connectToMongoDB();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.password !== oldPassword) {
      console.log('Incorrect old password for user:', userId);
      return res.status(401).json({ error: 'Incorrect old password' });
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: newPassword } }
    );

    if (result.modifiedCount === 0) {
      console.log('Failed to update password for user:', userId);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error in change-password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// admin password change route
router.post('/admin', async (req, res) => {
  console.log('Received change-password request (admin):', req.body);
  const { adminId, oldPassword, newPassword } = req.body;

  if (!adminId || !oldPassword || !newPassword) {
    console.log('Validation failed: Missing fields');
    return res.status(400).json({ error: 'Admin ID, old password, and new password are required' });
  }

  if (!ObjectId.isValid(adminId)) {
    console.log('Validation failed: Invalid adminId:', adminId);
    return res.status(400).json({ error: 'Invalid admin ID format' });
  }

  if (newPassword.length < 6) {
    console.log('Validation failed: New password too short');
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const db = await connectToMongoDB();
    const adminsCollection = db.collection('admin');
    const admin = await adminsCollection.findOne({ _id: new ObjectId(adminId) });
    if (!admin) {
      console.log('Admin not found:', adminId);
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (admin.password !== oldPassword) {
      console.log('Incorrect old password for admin:', adminId);
      return res.status(401).json({ error: 'Incorrect old password' });
    }

    const result = await adminsCollection.updateOne(
      { _id: new ObjectId(adminId) },
      { $set: { password: newPassword } }
    );

    if (result.modifiedCount === 0) {
      console.log('Failed to update password for admin:', adminId);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error in change-password for admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Seller password change route
router.post('/seller', async (req, res) => {
  console.log('Received change-password request (seller):', req.body);
  const { sellerId, oldPassword, newPassword } = req.body;

  if (!sellerId || !oldPassword || !newPassword) {
    console.log('Validation failed: Missing fields');
    return res.status(400).json({ error: 'Seller ID, old password, and new password are required' });
  }

  if (!ObjectId.isValid(sellerId)) {
    console.log('Validation failed: Invalid sellerId:', sellerId);
    return res.status(400).json({ error: 'Invalid seller ID format' });
  }

  if (newPassword.length < 6) {
    console.log('Validation failed: New password too short');
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const db = await connectToMongoDB();
    const sellersCollection = db.collection('sellers');
    const seller = await sellersCollection.findOne({ _id: new ObjectId(sellerId) });
    if (!seller) {
      console.log('Seller not found:', sellerId);
      return res.status(404).json({ error: 'Seller not found' });
    }

    if (seller.password !== oldPassword) {
      console.log('Incorrect old password for seller:', sellerId);
      return res.status(401).json({ error: 'Incorrect old password' });
    }

    const result = await sellersCollection.updateOne(
      { _id: new ObjectId(sellerId) },
      { $set: { password: newPassword } }
    );

    if (result.modifiedCount === 0) {
      console.log('Failed to update password for seller:', sellerId);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error in change-password for seller:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
