const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const app = express();
require('dotenv').config();

console.log('Environment Variables:', {
    GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
    CALLBACK_URL: CALLBACK_URL,
    mongoUri: mongoUri,
});

app.use(cors());
app.use(express.json());
app.use(session({ secret: 'siva1222', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
const mongoUri = process.env.mongoUri;

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB connection error: ', err));

// Define schema for milk bills
const milkSchema = new mongoose.Schema({
    date: String,
    totalLiters: Number,
    totalAmount: Number,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const MilkBill = mongoose.model('MilkBill', milkSchema);

// User schema for storing Google user information
const userSchema = new mongoose.Schema({
    googleId: String,
    displayName: String,
    firstName: String,
    lastName: String,
    image: String,
});

const User = mongoose.model('User', userSchema);

// Passport configuration
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
},
async (accessToken, refreshToken, profile, done) => {
    // Check for existing user
    const existingUser = await User.findOne({ googleId: profile.id });
    if (existingUser) {
        return done(null, existingUser);
    }
    
    // If not, create a new user
    const newUser = await new User({
        googleId: profile.id,
        displayName: profile.displayName,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        image: profile.picture,
    }).save();
    
    done(null, newUser);
}));

// Serialize user into the session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
});

// Auth routes
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
}));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
    // Successful authentication, redirect home or to a desired page
    res.redirect('/'); // Change this to redirect to a specific page after login
});

// API to get all milk bill records
app.get('/history', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
    }

    const bills = await MilkBill.find({ userId: req.user.id });
    res.json(bills);
});

// API to create a new bill entry
app.post('/add-bill', async (req, res) => {
    const { date, totalLiters, totalAmount } = req.body;

    if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
    }

    const newBill = new MilkBill({ date, totalLiters, totalAmount, userId: req.user.id });
    await newBill.save();
    res.json(newBill);
});

// API to delete a specific bill by ID
app.delete('/delete-bill/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await MilkBill.findByIdAndDelete(id);
        if (result) {
            res.status(200).json({ message: 'Bill deleted successfully' });
        } else {
            res.status(404).json({ message: 'Bill not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error deleting bill', error });
    }
});

// API to get a summary for the dashboard
app.get('/dashboard', async (req, res) => {
    const bills = await MilkBill.find();
    const totalLiters = bills.reduce((sum, bill) => sum + bill.totalLiters, 0);
    const totalAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    res.json({ totalLiters, totalAmount });
});

// Start server
const port = 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
