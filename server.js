const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');

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
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Milk schema
const milkSchema = new mongoose.Schema({
  email: { type: String, required: true },
  date: String,
  morningLiters: [Number],
  eveningLiters: [Number],
  pricePerLiter: Number,
  totalPrice: Number,
});

const Milk = mongoose.model('Milk', milkSchema);

// Middleware for session management
app.use(session({
  secret: 'siva1222', // Change this to a random secret key for better security
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }, // Set secure: true in production with HTTPS
}));

// User registration
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  // Check if the email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create a new user and save to the database
  const newUser = new User({ email, password: hashedPassword });
  await newUser.save();

  res.status(201).json({ message: 'User registered successfully' });
});

// User login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // Find the user by email
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  // Compare the provided password with the stored hashed password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  // Store email in session
  req.session.email = user.email;

  res.json({ message: 'Login successful', email: user.email });
});

// Middleware to authenticate user
const authenticateUser = (req, res, next) => {
  if (!req.session || !req.session.email) {
    return res.status(401).json({ message: 'Unauthorized access, please log in' });
  }
  next();
};

// Calculate and store milk data
app.post('/api/calculate', authenticateUser, async (req, res) => {
  const { date, morningLiters, eveningLiters, pricePerLiter } = req.body;
  const totalLiters = morningLiters.reduce((a, b) => a + b, 0) + eveningLiters.reduce((a, b) => a + b, 0);
  const totalPrice = totalLiters * pricePerLiter;

  // Create a new milk record linked to the logged-in user's email
  const newMilkRecord = new Milk({
    email: req.session.email,
    date,
    morningLiters,
    eveningLiters,
    pricePerLiter,
    totalPrice,
  });

  await newMilkRecord.save();
  res.json({ totalLiters, totalPrice });
});

// Delete a specific milk record
app.delete('/delete-bill/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Milk.findByIdAndDelete(id);
    if (result) {
      res.status(200).json({ message: 'Bill deleted successfully' });
    } else {
      res.status(404).json({ message: 'Bill not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error deleting bill', error });
  }
});

// Retrieve user-specific milk history
app.get('/api/history', authenticateUser, async (req, res) => {
  const history = await Milk.find({ email: req.session.email });
  res.json(history);
});

// Dashboard endpoint to get user-specific totals
app.get('/api/dashboard', authenticateUser, async (req, res) => {
  const history = await Milk.find({ email: req.session.email });
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
