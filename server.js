const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
require('dotenv').config(); // Load environment variables

const app = express();
console.log('Environment Variables:', {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CALLBACK_URL: process.env.CALLBACK_URL,
    mongoUri: process.env.mongoUri,
});

// Middleware
app.use(cors({
    origin: '*', // Allow requests from any origin
    credentials: true,
}));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret', // Use a secret from env variables
    resave: false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
const mongoUri = process.env.mongoUri;
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB connection error:', err));

// Define schemas
const milkSchema = new mongoose.Schema({
    date: String,
    totalLiters: Number,
    totalAmount: Number,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const MilkBill = mongoose.model('MilkBill', milkSchema);

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
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
},
async (accessToken, refreshToken, profile, done) => {
    try {
        const existingUser = await User.findOne({ googleId: profile.id });
        if (existingUser) {
            return done(null, existingUser);
        }

        const newUser = await new User({
            googleId: profile.id,
            displayName: profile.displayName,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            image: profile.picture,
        }).save();

        done(null, newUser);
    } catch (error) {
        console.error('Error in Google Strategy:', error);
        done(error, null); // Pass error to the done callback
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        console.error('Error during user deserialization:', error);
        done(error, null); // Handle errors during deserialization
    }
});

// Auth routes
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
}));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }),
(req, res) => {
    res.redirect('/'); // Redirect to a specific page after login
}, (err, req, res, next) => {
    console.error('Error during Google authentication:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err });
});

// API to get all milk bill records
app.get('/history', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
    }

    try {
        const bills = await MilkBill.find({ userId: req.user.id });
        res.json(bills);
    } catch (error) {
        console.error('Error fetching milk bills:', error);
        res.status(500).json({ message: 'Error fetching milk bills', error });
    }
});

// API to create a new bill entry
app.post('/add-bill', async (req, res) => {
    const { date, totalLiters, totalAmount } = req.body;

    if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
    }

    try {
        const newBill = new MilkBill({ date, totalLiters, totalAmount, userId: req.user.id });
        await newBill.save();
        res.json(newBill);
    } catch (error) {
        console.error('Error saving bill:', error);
        res.status(500).json({ message: 'Error saving bill', error });
    }
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
        console.error('Error deleting bill:', error);
        res.status(500).json({ message: 'Error deleting bill', error });
    }
});

// API to get a summary for the dashboard
app.get('/dashboard', async (req, res) => {
    try {
        const bills = await MilkBill.find();
        const totalLiters = bills.reduce((sum, bill) => sum + bill.totalLiters, 0);
        const totalAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
        res.json({ totalLiters, totalAmount });
    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ message: 'Error fetching dashboard summary', error });
    }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
