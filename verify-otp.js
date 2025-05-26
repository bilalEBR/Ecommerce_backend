// const express = require('express');
// const router = express.Router();
// const connectToMongoDB = require('./db');
// // const { ObjectId } = require('mongodb');
// const cors = require('cors');

// const userCollectionName = 'users';
// const otpCollectionName = 'otps';

// router.use(express.json()); 
// router.use(cors());

// router.post('/verify-otp', async (req, res) => {
//   try {
//     const db = await connectToMongoDB();
//     const userCollection = db.collection(userCollectionName);
//     const otpCollection = db.collection(otpCollectionName);

//     const { email, otp } = req.body;
//     if (!email || !otp) {
//       return res.status(400).json({ error: 'Email and OTP are required' });
//     }

//     // Find OTP
//     const otpDoc = await otpCollection.findOne({ email, otp });
//     if (!otpDoc) {
//       return res.status(400).json({ error: 'Invalid OTP' });
//     }

//     // Check expiry
//     if (otpDoc.expiresAt < new Date()) {
//       await otpCollection.deleteOne({ email, otp });
//       return res.status(400).json({ error: 'OTP has expired' });
//     }

//     // Find user
//     const user = await userCollection.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ error: 'User not found' });
//     }

//     // Generate new password (12 chars, alphanumeric)
//     const newPassword = Math.random().toString().slice(12);

//     // Update user password (plaintext, no hashing)
//     await userCollection.updateOne(
//       { email },
//       { $set: { password: newPassword, updatedAt: new Date() } }
//     );

//     // Delete OTP
//     await otpCollection.deleteOne({ email, otp });

//     console.log(`Password reset for ${email}, new password: ${newPassword}`);
//     res.status(200).json({ newPassword });
//   } catch (error) {
//     console.error('Error in verify-otp:', error);
//     res.status(500).json({ error: `Internal server error: ${error.message}` });
//   }
// });

// module.exports = router;

// to add admin and seller

const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const cors = require('cors');

const userCollectionName = 'users';
const adminCollectionName = 'admin';
const sellerCollectionName = 'sellers';
const otpCollectionName = 'otps';

router.use(express.json());
router.use(cors());

router.post('/verify-otp', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const userCollection = db.collection(userCollectionName);
    const adminCollection = db.collection(adminCollectionName);
    const sellerCollection = db.collection(sellerCollectionName);
    const otpCollection = db.collection(otpCollectionName);

    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Find OTP
    const otpDoc = await otpCollection.findOne({ email, otp });
    if (!otpDoc) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Check expiry
    if (otpDoc.expiresAt < new Date()) {
      await otpCollection.deleteOne({ email, otp });
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Generate new password (12 chars, alphanumeric)
    const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
 

    // Check which collection contains the email and update accordingly
    let updateResult;
    const [user, admin, seller] = await Promise.all([
      userCollection.findOne({ email }),
      adminCollection.findOne({ email }),
      sellerCollection.findOne({ email })
    ]);

    if (user) {
      updateResult = await userCollection.updateOne(
        { email },
        { $set: { password: newPassword, updatedAt: new Date() } }
      );
    } else if (admin) {
      updateResult = await adminCollection.updateOne(
        { email },
        { $set: { password: newPassword, updatedAt: new Date() } }
      );
    } else if (seller) {
      updateResult = await sellerCollection.updateOne(
        { email },
        { $set: { password: newPassword, updatedAt: new Date() } }
      );
    } else {
      return res.status(400).json({ error: 'Account not found' });
    }

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ error: 'Password update failed' });
    }

    // Delete OTP
    await otpCollection.deleteOne({ email, otp });

    console.log(`Password reset for ${email}, new password: ${newPassword}`);
    res.status(200).json({ newPassword });
  } catch (error) {
    console.error('Error in verify-otp:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

module.exports = router;