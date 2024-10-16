// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Create User schema and model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

// Hash password method (using bcrypt)
userSchema.methods.comparePassword = async function (candidatePassword) {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(candidatePassword, this.password);
};

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
    const bcrypt = require('bcrypt');
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

const User = mongoose.model('User', userSchema);

// Create a schema for milk records
const milkSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to user
    date: String,
    morningLiters: [Number],
    eveningLiters: [Number],
    pricePerLiter: Number,
    totalPrice: Number,
});

const Milk = mongoose.model('Milk', milkSchema);

// Register user
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const newUser = new User({ username, password });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login user
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// Middleware to authenticate user
const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.sendStatus(403);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user; // Store user data for use in routes
        next();
    });
};

// Calculate endpoint
app.post('/api/calculate', auth, async (req, res) => {
    const { date, morningLiters, eveningLiters, pricePerLiter } = req.body;
    const totalLiters = morningLiters.reduce((a, b) => a + b, 0) + eveningLiters.reduce((a, b) => a + b, 0);
    const totalPrice = totalLiters * pricePerLiter;

    const newMilkRecord = new Milk({
        userId: req.user.id, // Link record to user
        date,
        morningLiters,
        eveningLiters,
        pricePerLiter,
        totalPrice,
    });

    await newMilkRecord.save();
    res.json({ totalLiters, totalPrice });
});

// API to delete a specific bill by ID
app.delete('/delete-bill/:id', auth, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await Milk.findOneAndDelete({ _id: id, userId: req.user.id }); // Ensure bill belongs to user
        if (result) {
            res.status(200).json({ message: 'Bill deleted successfully' });
        } else {
            res.status(404).json({ message: 'Bill not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error deleting bill', error });
    }
});

// History endpoint
app.get('/api/history', auth, async (req, res) => {
    const history = await Milk.find({ userId: req.user.id }); // Fetch user's milk records
    res.json(history);
});

// Dashboard endpoint
app.get('/api/dashboard', auth, async (req, res) => {
    const history = await Milk.find({ userId: req.user.id }); // Fetch user's milk records
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
