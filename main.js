
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const connectToMongoDB = require('./db');
const { ObjectId } = require('mongodb');

// Route imports
const userRoutes = require('./user');
const productRoutes = require('./product');
const categoryRoutes = require('./category');
// const orderRoutes = require('./trash/orders');
const adminUsersRoutes = require('./adminuser');
const adminSellerRoutes = require('./adminsellers');
const adminCategoryRoutes = require('./admincategory');
const adminProductRoutes = require('./adminproduct');
const clientProductsRoutes = require('./clientproducts');
const sellerProductRoutes = require('./sellerproduct');
const sellerProfileRoutes = require('./sellerprofile');
const adminProfileRoutes = require('./adminprofile');
const userProfileRoutes = require('./userprofile');
const changePassword = require('./changepassword');
const adminAccountRoutes = require('./adminaccount');
const chatRoutes = require('./chat');
const authenticateToken = require('./auth');
const discountRoutes = require('./discount');
const clientOrdersRoutes = require('./clientorders');
const clientAddressRoutes = require('./clientaddress');
const chatProfileRoutes = require('./chatprofile');

console.log('changePassword module loaded:', changePassword);

const app = express();
const port = 3000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());
app.use(cors());

app.use('/uploads', express.static('uploads'));

// Socket.io logic
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat ${chatId}`);
  });

  socket.on('sendMessage', async (data) => {
    const { chatId, senderId, message } = data;

    if (!chatId || !senderId || !message) {
      socket.emit('messageError', { error: 'Invalid message data' });
      return;
    }

    try {
      const db = await connectToMongoDB();
      const chatsCollection = db.collection('chats');

      const newMessage = {
        senderId,
        message,
        timestamp: new Date().toISOString(),
      };

      await chatsCollection.updateOne(
        { _id: new ObjectId(chatId) },
        { $push: { messages: newMessage } }
      );

      io.to(chatId).emit('receiveMessage', newMessage);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('messageError', { error: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Route mounting

app.use('/', userRoutes);
app.use('/products', productRoutes);
app.use('/categories', categoryRoutes);
app.use('/orders', orderRoutes);
app.use('/admin/users', adminUsersRoutes);
app.use('/admin/sellers', adminSellerRoutes);
app.use('/admin/categories', adminCategoryRoutes);
app.use('/admin/products', adminProductRoutes);
app.use('/admin', adminProfileRoutes);
app.use('/adminAccount', adminAccountRoutes);
app.use('/client-products', authenticateToken, clientProductsRoutes);
app.use('/', sellerProductRoutes);
app.use('/', sellerProfileRoutes);
app.use('/', userProfileRoutes);
app.use('/', chatRoutes);
app.use('/', discountRoutes);
app.use('/', clientOrdersRoutes);
app.use('/', clientAddressRoutes);
app.use('/chatprofile', chatProfileRoutes);
app.use('/change-password', changePassword);

// 404 Handler
app.use((req, res) => {
  console.log(`404: Route not found - ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
