// const express = require('express');
// const router = express.Router();
// const connectToMongoDB = require('./db');
// const cors = require('cors');
// const sendEmail = require('./send-email');

// const userCollectionName = 'users';
// const otpCollectionName = 'otps';

// router.use(express.json());
// router.use(cors());

// router.post('/forgot-password', async (req, res) => {
//   try {
//     const db = await connectToMongoDB();
//     const userCollection = db.collection(userCollectionName);
//     const otpCollection = db.collection(otpCollectionName);

//     const { email } = req.body;
//     if (!email) {
//       return res.status(400).json({ error: 'Email is required' });
//     }

//     // Check if user exists
//     const user = await userCollection.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ error: 'Email not found' });
//     }

    
//     // Generate 6-digit OTP
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();


//     const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute expiry

//     // Store OTP, overwrite existing OTP for email
//     await otpCollection.deleteMany({ email });
//     await otpCollection.insertOne({
//       email,
//       otp,
//       expiresAt,
//       createdAt: new Date(),
//     });

//     // Send OTP via email (mocked)
//     await sendEmail(email, 'Your OTP for Password Reset', `Your OTP is ${otp}. It expires in 5 minutes.`);

//     console.log(`OTP ${otp} generated for ${email}`);
//     res.status(200).json({ message: 'OTP sent successfully' });
//   } catch (error) {
//     console.error('Error in forgot-password:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// module.exports = router;

// to add admin and sellr 

const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const cors = require('cors');
const sendEmail = require('./send-email');

const userCollectionName = 'users';
const adminCollectionName = 'admin';
const sellerCollectionName = 'sellers';
const otpCollectionName = 'otps';

router.use(express.json());
router.use(cors());

router.post('/forgot-password', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const userCollection = db.collection(userCollectionName);
    const adminCollection = db.collection(adminCollectionName);
    const sellerCollection = db.collection(sellerCollectionName);
    const otpCollection = db.collection(otpCollectionName);

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if email exists in any collection
    const [user, admin, seller] = await Promise.all([
      userCollection.findOne({ email }),
      adminCollection.findOne({ email }),
      sellerCollection.findOne({ email })
    ]);

    if (!user && !admin && !seller) {
      return res.status(400).json({ error: 'Email not found' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute expiry

    // Store OTP, overwrite existing OTP for email
    await otpCollection.deleteMany({ email });
    await otpCollection.insertOne({
      email,
      otp,
      expiresAt,
      createdAt: new Date(),
    });

    // Send OTP via email
    await sendEmail(email, 'Your OTP for Password Reset', `Your OTP is ${otp}. It expires in 5 minutes.`);

    console.log(`OTP ${otp} generated for ${email}`);
    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;