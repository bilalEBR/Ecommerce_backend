

const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const { ObjectId } = require('mongodb');
const authenticateToken = require('./auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Image upload endpoint
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const filePath = `/Uploads/${req.file.filename}`;
  res.status(200).json({ filePath });
});

// Fetch user profile by userId
router.get('/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('Fetching user profile for userId:', userId);

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const db = await connectToMongoDB();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { firstName: 1, lastName: 1, email: 1, profileImage: 1 } }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      profileImage: user.profileImage || null
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Initiate a chat (client side)
router.post('/chat/initiate', authenticateToken, async (req, res) => {
  try {
    const clientId = req.userId;
    const userRole = req.role;
    const { productId } = req.body;

    console.log('Initiating chat - clientId:', clientId, 'productId:', productId, 'role:', userRole);

    if (userRole !== 'client') {
      return res.status(403).json({ message: 'Only clients can initiate chats' });
    }

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    if (!ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID format' });
    }

    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const db = await connectToMongoDB();
    const productsCollection = db.collection('products');
    const usersCollection = db.collection('users');
    const chatsCollection = db.collection('chats');

    const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const sellerId = product.sellerId;
    const productName = product.title;

    const client = await usersCollection.findOne({ _id: new ObjectId(clientId) });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    const clientName = `${client.firstName} ${client.lastName}`;

    let chat = await chatsCollection.findOne({
      productId: productId,
      clientId: clientId,
      sellerId: sellerId,
    });

    if (!chat) {
      const newChat = {
        productId: productId,
        productName: productName,
        clientId: clientId,
        clientName: clientName,
        sellerId: sellerId.toString(),
        messages: [],
        createdAt: new Date().toISOString(),
      };
      const result = await chatsCollection.insertOne(newChat);
      chat = { _id: result.insertedId, ...newChat };
    }

    res.status(200).json({ chatId: chat._id.toString() });
  } catch (error) {
    console.error('Error initiating chat:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Fetch all chats for a seller
router.get('/chat/seller', authenticateToken, async (req, res) => {
  try {
    const sellerId = req.userId;
    console.log('Fetching chats for sellerId:', sellerId);
    const db = await connectToMongoDB();
    const chatsCollection = db.collection('chats');

    const chats = await chatsCollection
      .find({ sellerId: sellerId })
      .sort({ 'messages.timestamp': -1 })
      .toArray();

    console.log('Fetched chats:', chats);

    const formattedChats = chats.map(chat => {
      const latestMessage = chat.messages && chat.messages.length > 0 ? chat.messages.slice(-1)[0] : {};
      return {
        _id: chat._id.toString(),
        productName: chat.productName || 'Unknown Product',
        clientName: chat.clientName || 'Unknown Client',
        latestMessage: latestMessage.message || 'No messages yet',
        latestMessageTime: latestMessage.timestamp || chat.createdAt || new Date().toISOString(),
      };
    });

    res.status(200).json(formattedChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Fetch a specific chat by chatId
router.get('/chat/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;
    console.log('Fetching chat with chatId:', chatId, 'for userId:', userId);

    if (!ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID format' });
    }

    const db = await connectToMongoDB();
    const chatsCollection = db.collection('chats');

    const chat = await chatsCollection.findOne({ _id: new ObjectId(chatId) });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (chat.clientId !== userId && chat.sellerId !== userId) {
      return res.status(403).json({ message: 'Unauthorized to access this chat' });
    }

    res.status(200).json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Delete a chat for a seller
router.delete('/chat/seller/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const sellerId = req.userId;
    console.log('Deleting chat with chatId:', chatId, 'for sellerId:', sellerId);

    if (!ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID format' });
    }

    const db = await connectToMongoDB();
    const chatsCollection = db.collection('chats');

    const result = await chatsCollection.deleteOne({
      _id: new ObjectId(chatId),
      sellerId: sellerId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Chat not found or you are not authorized to delete it' });
    }

    res.status(200).json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Socket.io integration
router.setupSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinChat', (chatId) => {
      socket.join(chatId);
      console.log(`User ${socket.id} joined chat ${chatId}`);
    });

    socket.on('sendMessage', async (data) => {
      const { chatId, senderId, message, timestamp, isImage } = data;
      const messageData = {
        senderId: senderId,
        message: message,
        timestamp: timestamp,
        isImage: isImage || false,
        status: 'sent',
      };

      try {
        const db = await connectToMongoDB();
        const chatsCollection = db.collection('chats');
        await chatsCollection.updateOne(
          { _id: new ObjectId(chatId) },
          { $push: { messages: messageData } }
        );
      } catch (error) {
        console.error('Error saving message to DB:', error);
      }

      io.to(chatId).emit('receiveMessage', messageData);
    });

    socket.on('messageSeen', async (data) => {
      const { chatId, messageTimestamp } = data;
      try {
        const db = await connectToMongoDB();
        const chatsCollection = db.collection('chats');
        await chatsCollection.updateOne(
          { _id: new ObjectId(chatId), 'messages.timestamp': messageTimestamp },
          { $set: { 'messages.$.status': 'seen' } }
        );
      } catch (error) {
        console.error('Error updating message status:', error);
      }
      io.to(chatId).emit('messageSeen', { messageTimestamp });
    });

    socket.on('typing', (chatId) => {
      socket.broadcast.to(chatId).emit('typing');
    });

    socket.on('online', (chatId) => {
      socket.broadcast.to(chatId).emit('online');
    });

    socket.on('offline', (chatId) => {
      socket.broadcast.to(chatId).emit('offline');
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = router;



