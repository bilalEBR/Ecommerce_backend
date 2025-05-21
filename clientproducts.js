
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const cors = require('cors');
const { ObjectId } = require('mongodb');

const collectionName = 'products';

router.use(express.json());
router.use(cors());

// GET all products (requires authentication due to main.js setup)
router.get('/', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const query = {};

    if (req.query.categoryId) {
      console.log('Received categoryId:', req.query.categoryId);
      if (!ObjectId.isValid(req.query.categoryId)) {
        return res.status(400).json({ error: 'Invalid category ID format' });
      }
      query.$or = [
        { category: req.query.categoryId },
        { categoryId: req.query.categoryId }
      ];
    }

    if (req.query.productId) {
      console.log('Received productId:', req.query.productId);
      if (!ObjectId.isValid(req.query.productId)) {
        return res.status(400).json({ error: 'Invalid product ID format' });
      }
      query._id = new ObjectId(req.query.productId);
    }

    console.log('Query for products:', query);
    const products = await collection.find(query).toArray();
    console.log('Fetched products:', products);

    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products for clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET user's rating for a product (requires authentication)
router.get('/rating/:productId', async (req, res) => {
  const { productId } = req.params;
  const userId = req.userId;

  if (!ObjectId.isValid(productId)) {
    return res.status(400).json({ error: 'Invalid product ID format' });
  }
  if (!userId || !ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);

    const product = await collection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const userRating = product.userRatings?.find((r) => r.userId === userId)?.rating || null;

    res.status(200).json({ rating: userRating });
  } catch (error) {
    console.error('Error fetching user rating:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST to submit a review (requires authentication, only for verified buyers)
router.post('/reviews/:productId', async (req, res) => {
  const { productId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.userId; // From JWT token
  const userRole = req.role; // From JWT token

  // Validate input
  if (!ObjectId.isValid(productId)) {
    return res.status(400).json({ error: 'Invalid product ID format' });
  }
  if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
  }
  if (comment && typeof comment !== 'string') {
    return res.status(400).json({ error: 'Comment must be a string' });
  }
  if (!userId || !ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  if (userRole !== 'client') {
    return res.status(403).json({ error: 'Only clients can submit reviews' });
  }

  try {
    const db = await connectToMongoDB();
    const productsCollection = db.collection(collectionName);
    const reviewsCollection = db.collection('reviews');
    const ordersCollection = db.collection('orders');
    const usersCollection = db.collection('users');

    // Verify purchase
    const order = await ordersCollection.findOne({
      userId,
      status: 'completed',
      items: { $elemMatch: { productId } },
    });
    if (!order) {
      return res.status(403).json({ error: 'Only users who purchased this product can review it' });
    }

    // Check if user already reviewed
    const existingReview = await reviewsCollection.findOne({
      productId: new ObjectId(productId),
      userId,
    });
    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    // Verify product exists
    const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get user details
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log user profile data for debugging
    console.log('User profile for review:', {
      userId,
      username: user.username,
      profilePicture: user.profilePicture
    });

    // Create review
    const review = {
      productId: new ObjectId(productId),
      userId,
      username: user.username || 'Anonymous',
      profileImage: user.profilePicture || null,
      rating,
      comment: comment || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const reviewResult = await reviewsCollection.insertOne(review);

    // Update product userRatings
    const userRatings = product.userRatings || [];
    const existingRatingIndex = userRatings.findIndex((r) => r.userId === userId);
    if (existingRatingIndex !== -1) {
      userRatings[existingRatingIndex].rating = rating;
    } else {
      userRatings.push({ userId, rating });
    }
    const totalRating = userRatings.reduce((sum, r) => sum + r.rating, 0);
    const newAverageRating = totalRating / userRatings.length;
    const newRatingCount = userRatings.length;

    await productsCollection.updateOne(
      { _id: new ObjectId(productId) },
      {
        $set: {
          userRatings,
          averageRating: newAverageRating,
          ratingCount: newRatingCount,
        },
      }
    );

    res.status(201).json({ message: 'Review submitted successfully', reviewId: reviewResult.insertedId });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT to update a review (requires authentication, only by review owner)
router.put('/reviews/:reviewId', async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.userId;
  const userRole = req.role;

  // Validate input
  if (!ObjectId.isValid(reviewId)) {
    return res.status(400).json({ error: 'Invalid review ID format' });
  }
  if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
  }
  if (comment && typeof comment !== 'string') {
    return res.status(400).json({ error: 'Comment must be a string' });
  }
  if (!userId || !ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  if (userRole !== 'client') {
    return res.status(403).json({ error: 'Only clients can update reviews' });
  }

  try {
    const db = await connectToMongoDB();
    const reviewsCollection = db.collection('reviews');
    const productsCollection = db.collection('products');
    const usersCollection = db.collection('users');

    // Find review
    const review = await reviewsCollection.findOne({ _id: new ObjectId(reviewId) });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (review.userId !== userId) {
      return res.status(403).json({ error: 'You can only update your own review' });
    }

    // Get user details to ensure profileImage is up-to-date
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update review
    const updateResult = await reviewsCollection.updateOne(
      { _id: new ObjectId(reviewId) },
      {
        $set: {
          rating,
          comment: comment || '',
          profileImage: user.profilePicture || null,
          username: user.username || 'Anonymous',
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ error: 'Failed to update review' });
    }

    // Update product userRatings
    const product = await productsCollection.findOne({ _id: new ObjectId(review.productId) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const userRatings = product.userRatings || [];
    const ratingIndex = userRatings.findIndex((r) => r.userId === userId);
    if (ratingIndex !== -1) {
      userRatings[ratingIndex].rating = rating;
      const totalRating = userRatings.reduce((sum, r) => sum + r.rating, 0);
      const newAverageRating = totalRating / userRatings.length;
      const newRatingCount = userRatings.length;

      await productsCollection.updateOne(
        { _id: new ObjectId(review.productId) },
        {
          $set: {
            userRatings,
            averageRating: newAverageRating,
            ratingCount: newRatingCount,
          },
        }
      );
    }

    res.status(200).json({ message: 'Review updated successfully' });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE a review (requires authentication, only by review owner)
router.delete('/reviews/:reviewId', async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.userId;
  const userRole = req.role;

  // Validate input
  if (!ObjectId.isValid(reviewId)) {
    return res.status(400).json({ error: 'Invalid review ID format' });
  }
  if (!userId || !ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  if (userRole !== 'client') {
    return res.status(403).json({ error: 'Only clients can delete reviews' });
  }

  try {
    const db = await connectToMongoDB();
    const reviewsCollection = db.collection('reviews');
    const productsCollection = db.collection('products');

    // Find review
    const review = await reviewsCollection.findOne({ _id: new ObjectId(reviewId) });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (review.userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own review' });
    }

    // Delete review
    const deleteResult = await reviewsCollection.deleteOne({ _id: new ObjectId(reviewId) });
    if (deleteResult.deletedCount === 0) {
      return res.status(400).json({ error: 'Failed to delete review' });
    }

    // Update product userRatings
    const product = await productsCollection.findOne({ _id: new ObjectId(review.productId) });
    if (product) {
      const userRatings = (product.userRatings || []).filter((r) => r.userId !== userId);
      const newAverageRating = userRatings.length > 0 ? userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length : 0;
      const newRatingCount = userRatings.length;

      await productsCollection.updateOne(
        { _id: new ObjectId(review.productId) },
        {
          $set: {
            userRatings,
            averageRating: newAverageRating,
            ratingCount: newRatingCount,
          },
        }
      );
    }

    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET reviews for a product
router.get('/reviews/:productId', async (req, res) => {
  const { productId } = req.params;
  const { limit = 10, skip = 0 } = req.query;

  if (!ObjectId.isValid(productId)) {
    return res.status(400).json({ error: 'Invalid product ID format' });
  }

  try {
    const db = await connectToMongoDB();
    const reviewsCollection = db.collection('reviews');
    const usersCollection = db.collection('users');

    // Fetch reviews
    const reviews = await reviewsCollection
      .find({ productId: new ObjectId(productId) })
      .sort({ updatedAt: -1 }) // Newest updates first
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .toArray();

    // Fetch user details for each review
    const enrichedReviews = await Promise.all(
      reviews.map(async (review) => {
        const user = await usersCollection.findOne({ _id: new ObjectId(review.userId) });
        return {
          ...review,
          username: user?.username || review.username || 'Anonymous',
          profileImage: user?.profilePicture || review.profileImage || null
        };
      })
    );

    const totalReviews = await reviewsCollection.countDocuments({ productId: new ObjectId(productId) });

    // Log the reviews being sent to the frontend
    console.log('Sending reviews:', enrichedReviews);

    res.status(200).json({ reviews: enrichedReviews, totalReviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST to rate a product (requires authentication, only for clients)
router.post('/rate-product', async (req, res) => {
  const { productId, rating } = req.body;
  const userId = req.userId; 
  const userRole = req.role; 

  // Validate input
  if (!productId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Invalid product ID or rating (must be between 1 and 5)' });
  }

  // Validate userId
  if (!userId) {
    console.log('userId is missing:', userId);
    return res.status(400).json({ error: 'User ID is missing' });
  }

  // Ensure userId is treated as a string
  const userIdStr = userId.toString();
  if (!ObjectId.isValid(userIdStr)) {
    console.log('userId is not a valid ObjectId:', userIdStr);
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);

    // Check if the user is a client and exists in the users collection
    if (userRole !== 'client') {
      return res.status(403).json({ error: 'Only clients can rate products' });
    }

    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userIdStr) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate product ID
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    // Check if the product exists
    const product = await collection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Initialize userRatings array if it doesn't exist
    if (!product.userRatings) {
      await collection.updateOne(
        { _id: new ObjectId(productId) },
        { $set: { userRatings: [] } }
      );
      product.userRatings = [];
    }

    // Check if the user has already rated this product
    const existingRatingIndex = product.userRatings.findIndex(
      (r) => r.userId === userIdStr // Compare as strings
    );

    let newAverageRating;
    let newRatingCount;

    if (existingRatingIndex !== -1) {
      // User has already rated; update their rating
      const oldRating = product.userRatings[existingRatingIndex].rating;
      product.userRatings[existingRatingIndex].rating = rating;

      // Recalculate averageRating
      const totalRating = product.userRatings.reduce((sum, r) => sum + r.rating, 0);
      newAverageRating = totalRating / product.userRatings.length;
      newRatingCount = product.userRatings.length;
    } else {
      // User hasn't rated; add their rating
      product.userRatings.push({ userId: userIdStr, rating }); // Store userId as string

      // Recalculate averageRating and ratingCount
      const totalRating = product.userRatings.reduce((sum, r) => sum + r.rating, 0);
      newAverageRating = totalRating / product.userRatings.length;
      newRatingCount = product.userRatings.length;
    }

    // Update the product with the new userRatings, averageRating, and ratingCount
    await collection.updateOne(
      { _id: new ObjectId(productId) },
      {
        $set: {
          userRatings: product.userRatings,
          averageRating: newAverageRating,
          ratingCount: newRatingCount,
        },
      }
    );

    res.status(200).json({ message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
