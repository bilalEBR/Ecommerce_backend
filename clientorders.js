
const express = require('express');
const router = express.Router();
const connectToMongoDB = require('./db');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const authenticateToken = require('./auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

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

router.use(express.json());
router.use(cors());

// GET endpoint to fetch account details based on the selected bank
router.get('/admin/accounts', async (req, res) => {
  const { bank } = req.query;
  console.log('Received request for bank:', bank);

  if (!bank) {
    return res.status(400).json({ message: 'Bank name is required' });
  }

  try {
    const db = await connectToMongoDB();
    const adminAccountsCollection = db.collection('adminAccount');

    const accounts = await adminAccountsCollection.find({ bank }).toArray();
    res.status(200).json(accounts);
  } catch (error) {
    console.error('Error fetching admin accounts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET endpoint to fetch orders for a specific client
router.get('/client/orders/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;

  console.log('Received request to fetch orders for userId:', userId);
  console.log('Token payload (req.user):', req.user);

  if (req.userId !== userId) {
    return res.status(403).json({ message: 'Unauthorized to view these orders' });
  }

  if (!ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user ID format' });
  }

  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');

    const orders = await ordersCollection.find({ userId }).toArray();
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET endpoint to fetch all orders (for admin)
router.get('/admin/orders', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');

    const orders = await ordersCollection.find().toArray();
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT endpoint to update the status of an order (for admin)
router.put('/admin/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!ObjectId.isValid(orderId)) {
    return res.status(400).json({ message: 'Invalid order ID format' });
  }

  if (!status || !['pending', 'completed', 'canceled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');

    // Fetch the order to get items for quantity restoration and orderDate
    const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Prepare update fields
    const updateFields = { status };
    if (status === 'completed' && order.deliveryDate == null) {
      const orderDate = new Date(order.orderDate);
      const deliveryDate = new Date(orderDate);
      deliveryDate.setDate(orderDate.getDate() + 3);
      updateFields.deliveryDate = deliveryDate;
    }

    // Update the order status and deliveryDate (if applicable)
    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(orderId) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 1) {
      // If status is 'canceled', restore product quantities
      if (status === 'canceled') {
        const quantityItems = order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }));
        console.log('Restoring quantities for canceled order', orderId, ':', quantityItems);
        const quantityResponse = await fetch('http://localhost:3000/products/increase-quantities', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: quantityItems })
        });
        if (quantityResponse.status !== 200) {
          const error = await quantityResponse.json();
          console.error('Failed to restore quantities for order', orderId, ':', error);
          return res.status(quantityResponse.status).json({ message: `Failed to restore quantities: ${error.message}` });
        }
      }
      res.status(200).json({ message: 'Order status updated successfully' });
    } else {
      res.status(404).json({ message: 'Order not found or status not updated' });
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE endpoint to delete an order (for admin)
router.delete('/admin/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;

  if (!ObjectId.isValid(orderId)) {
    return res.status(400).json({ message: 'Invalid order ID format' });
  }

  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');

    // Fetch the order to check status
    const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow deletion of completed or canceled orders
    if (order.status !== 'completed' && order.status !== 'canceled') {
      return res.status(403).json({ message: 'Only completed or canceled orders can be deleted' });
    }

    // Delete the order
    const result = await ordersCollection.deleteOne({ _id: new ObjectId(orderId) });

    if (result.deletedCount === 1) {
      res.status(200).json({ message: 'Order deleted successfully' });
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST endpoint to create a new order
router.post('/client/orders', authenticateToken, upload.single('recipientScreenshot'), async (req, res) => {
  const {
    userId,
    items,
    total,
    paymentMethod,
    accountHolderName,
    accountNumber,
    transactionId,
    status,
    shippingAddress,
    orderDate
  } = req.body;

  const recipientScreenshot = req.file ? `/Uploads/${req.file.filename}` : null;

  console.log('Received request to create order for userId:', userId);
  console.log('Token payload (req.user):', req.user);
  console.log('Comparing req.userId:', req.userId, 'with userId:', userId);

  if (req.userId !== userId) {
    return res.status(403).json({ message: 'Unauthorized to create this order' });
  }

  if (!ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user ID format' });
  }

  if (!userId || !items || !total || !paymentMethod || !accountHolderName || !accountNumber || !transactionId || !orderDate) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');

    const parsedItems = JSON.parse(items);
    const parsedShippingAddress = shippingAddress ? JSON.parse(shippingAddress) : null;

    const order = {
      userId,
      items: parsedItems,
      total: parseFloat(total),
      paymentMethod,
      accountHolderName,
      accountNumber,
      recipientScreenshot,
      transactionId,
      status: status || 'pending',
      shippingAddress: parsedShippingAddress,
      orderDate: new Date(orderDate),
      deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate) : null
    };

    const result = await ordersCollection.insertOne(order);
    if (result.insertedId) {
      // Decrease product quantities
      const quantityItems = parsedItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));
      console.log('Decreasing quantities for order', result.insertedId, ':', quantityItems);
      const quantityResponse = await fetch('http://localhost:3000/products/decrease-quantities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: quantityItems })
      });
      if (quantityResponse.status !== 200) {
        // Roll back order creation
        await ordersCollection.deleteOne({ _id: result.insertedId });
        const error = await quantityResponse.json();
        console.error('Failed to decrease quantities for order', result.insertedId, ':', error);
        return res.status(quantityResponse.status).json({ message: `Failed to decrease quantities: ${error.message}` });
      }

      res.status(201).json({ ...order, _id: result.insertedId });
    } else {
      res.status(500).json({ message: 'Failed to create order' });
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET orders over time (for chart)
router.get('/orders-over-time', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');

    const ordersOverTime = await ordersCollection.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$orderDate" },
            month: { $month: "$orderDate" },
          },
          count: { $sum: 1 },
          totalPrice: { $sum: "$total" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]).toArray();

    // Format the response as an array of { date: "YYYY-MM", count: number, totalPrice: number }
    const formattedData = ordersOverTime.map(item => ({
      date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
      count: item.count,
      totalPrice: item.totalPrice,
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error('Error fetching orders over time:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET total number of orders (for summary)
router.get('/total-orders', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');
    const totalOrders = await ordersCollection.countDocuments();
    res.status(200).json({ totalOrders });
  } catch (error) {
    console.error('Error fetching total orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET order status breakdown (for summary)
router.get('/order-status-breakdown', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');

    const statusBreakdown = await ordersCollection.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]).toArray();

  
    const formattedData = {
      completed: 0,
      pending: 0,
      canceled: 0,
    };

    statusBreakdown.forEach(item => {
      if (item._id === 'completed') formattedData.completed = item.count;
      if (item._id === 'pending') formattedData.pending = item.count;
      if (item._id === 'canceled') formattedData.canceled = item.count;
    });

    res.status(200).json(formattedData);
  } catch (error) {
    console.error('Error fetching order status breakdown:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET completed orders stats (for summary: number of completed orders and total price)
router.get('/completed-orders-stats', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');

    const completedOrdersStats = await ordersCollection.aggregate([
      {
        $match: { status: 'completed' },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalPrice: { $sum: "$total" },
        },
      },
    ]).toArray();

    const result = completedOrdersStats.length > 0
      ? { completedOrders: completedOrdersStats[0].count, totalPrice: completedOrdersStats[0].totalPrice }
      : { completedOrders: 0, totalPrice: 0 };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching completed orders stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET endpoint to fetch all sellers
router.get('/admin/sellers', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const sellersCollection = db.collection('sellers');
    console.log('Fetching sellers from collection: sellers');
    const sellers = await sellersCollection.find({}, { projection: { _id: 1, firstName: 1, lastName: 1, email: 1, profilePicture: 1 } }).toArray();
    console.log(`Fetched ${sellers.length} sellers:`, JSON.stringify(sellers, null, 2));
    res.status(200).json(sellers);
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET endpoint to fetch all products
router.get('/admin/products', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const productsCollection = db.collection('products');
    console.log('Fetching products from collection: products');
    const products = await productsCollection.find({}).toArray();
    console.log(`Fetched ${products.length} products:`, JSON.stringify(products, null, 2));
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET endpoint to fetch sold products with seller details
router.get('/admin/sold-products', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');
    const productsCollection = db.collection('products');
    const sellersCollection = db.collection('sellers');

    // Fetch completed orders
    const completedOrders = await ordersCollection.find({ status: 'completed' }).toArray();
    console.log(`Found ${completedOrders.length} completed orders`);

    // Fetch all products and sellers for lookup
    const products = await productsCollection.find({}).toArray();
    const sellers = await sellersCollection.find({}, { projection: { _id: 1, firstName: 1, lastName: 1, email: 1, profilePicture: 1 } }).toArray();
    console.log(`Fetched ${products.length} products:`, JSON.stringify(products, null, 2));
    console.log(`Fetched ${sellers.length} sellers:`, JSON.stringify(sellers, null, 2));

    // Create lookup maps
    const productMap = {};
    products.forEach(p => {
      const idStr = p._id.toString();
      productMap[idStr] = p.productName || p.name || p.title || p.product_name || 'Unknown Product';
      // Also try ObjectId format
      try {
        const idObj = new ObjectId(p._id).toString();
        productMap[idObj] = p.productName || p.name || p.title || p.product_name || 'Unknown Product';
      } catch (e) {
        console.log(`Invalid ObjectId for product _id: ${p._id}`);
      }
    });
    const sellerMap = {};
    sellers.forEach(s => {
      const idStr = s._id.toString();
      const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email || 'Unknown Seller';
      sellerMap[idStr] = { name, profilePicture: s.profilePicture || null };
      // Also try ObjectId format
      try {
        const idObj = new ObjectId(s._id).toString();
        sellerMap[idObj] = { name, profilePicture: s.profilePicture || null };
      } catch (e) {
        console.log(`Invalid ObjectId for seller _id: ${s._id}`);
      }
    });

    // Process orders to extract sold products with seller details
    const soldProductsBySeller = {};

    for (const order of completedOrders) {
      console.log(`Processing order ${order._id}`);
      for (const item of order.items) {
        console.log(`Processing item with productId: ${item.productId}, sellerId: ${item.sellerId}`);

        // Try both string and ObjectId for lookup
        const productName = productMap[item.productId] || productMap[new ObjectId(item.productId).toString()] || 'Unknown Product';
        const sellerInfo = sellerMap[item.sellerId] || sellerMap[new ObjectId(item.sellerId).toString()] || { name: 'Unknown Seller', profilePicture: null };
        console.log(`Product lookup for ${item.productId}: ${productName}`);
        console.log(`Seller lookup for ${item.sellerId}: ${sellerInfo.name}, ProfilePicture: ${sellerInfo.profilePicture}`);

        const sellerId = item.sellerId;
        if (!soldProductsBySeller[sellerId]) {
          soldProductsBySeller[sellerId] = {
            seller: {
              id: sellerId,
              name: sellerInfo.name,
              profilePicture: sellerInfo.profilePicture,
            },
            products: [],
            totalPrice: 0,
            totalAfterFee: 0,
          };
        }

        const itemPrice = item.price * item.quantity;
        soldProductsBySeller[sellerId].products.push({
          productId: item.productId,
          name: productName,
          image: item.image || null,
          price: item.price,
          quantity: item.quantity,
          totalItemPrice: itemPrice,
          orderId: order._id.toString(),
          orderDate: order.orderDate,
        });
        soldProductsBySeller[sellerId].totalPrice += itemPrice;
      }
    }

    // Calculate totalAfterFee for each seller (5% fee on totalPrice)
    Object.values(soldProductsBySeller).forEach(seller => {
      seller.totalAfterFee = seller.totalPrice * 0.95;
    });

    // Convert to array format
    const response = Object.values(soldProductsBySeller);
    console.log(`Returning ${response.length} sellers with sold products:`, JSON.stringify(response, null, 2));
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching sold products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});






router.get('/seller/orders/:sellerId', authenticateToken, async (req, res) => {
  const { sellerId } = req.params;

  console.log('Received request to fetch orders for sellerId:', sellerId);
  console.log('Token payload (req.user):', req.user);

  if (!ObjectId.isValid(sellerId)) {
    return res.status(400).json({ message: 'Invalid seller ID format' });
  }

  try {
    const db = await connectToMongoDB();
    const ordersCollection = db.collection('orders');

    
    const orders = await ordersCollection
      .find({ 'items.sellerId': sellerId })
      .toArray();
    console.log(`Found ${orders.length} orders for seller ${sellerId}`);

    
    const filteredOrders = orders.map(order => {
      const sellerItems = order.items.filter(item => item.sellerId === sellerId);
      return {
        ...order,
        items: sellerItems,
        createdAt: order.orderDate, 
      };
    });

    
    filteredOrders.forEach(order => {
      console.log(`Order ${order._id}: status=${order.status}, deliveryDate=${order.deliveryDate}`);
    });

    console.log(`Returning ${filteredOrders.length} orders for seller ${sellerId}`);
    res.status(200).json(filteredOrders);
  } catch (error) {
    console.error('Error fetching orders for seller:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;