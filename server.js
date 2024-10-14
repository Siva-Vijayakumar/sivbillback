const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
const mongoUri = 'mongodb+srv://sivbill_company:siva1222@cluster0.le65a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.log('MongoDB connection error:', err));

// User schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const User = mongoose.model('User', userSchema);

// Milk schema
const milkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to the user
  date: String,
  morningLiters: [Number],
  eveningLiters: [Number],
  pricePerLiter: Number,
  totalPrice: Number,
});

const Milk = mongoose.model('Milk', milkSchema);

// User registration
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashedPassword });
  await newUser.save();
  res.status(201).json({ message: 'User registered successfully' });
});

// User login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: 'User not found' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id }, 'YOUR_SECRET_KEY'); // Use a secure key in production
  res.json({ token });
});

// Middleware to authenticate the token
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, 'YOUR_SECRET_KEY', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; // Save the user information in the request
    next();
  });
});

// Calculate endpoint
app.post('/api/calculate', authenticateToken, async (req, res) => {
  const { date, morningLiters, eveningLiters, pricePerLiter } = req.body;
  const totalLiters = morningLiters.reduce((a, b) => a + b, 0) + eveningLiters.reduce((a, b) => a + b, 0);
  const totalPrice = totalLiters * pricePerLiter;

  const newMilkRecord = new Milk({
    userId: req.user.id, // Save userId from the token
    date,
    morningLiters,
    eveningLiters,
    pricePerLiter,
    totalPrice,
  });

  await newMilkRecord.save();
  res.json({ totalLiters, totalPrice });
});

// History endpoint
app.get('/api/history', authenticateToken, async (req, res) => {
  const history = await Milk.find({ userId: req.user.id }); // Fetch records for the logged-in user
  res.json(history);
});

// Dashboard endpoint
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  const history = await Milk.find({ userId: req.user.id });
  const totalLiters = history.reduce((acc, record) => {
    return acc + record.morningLiters.reduce((a, b) => a + b, 0) + record.eveningLiters.reduce((a, b) => a + b, 0);
  }, 0);
  const totalRevenue = history.reduce((acc, record) => acc + record.totalPrice, 0);
  res.json({ totalLiters, totalRevenue });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
