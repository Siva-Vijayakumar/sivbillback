const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const passport = require('passport');
const GoogleTokenStrategy = require('passport-google-id-token');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Create a schema
const milkSchema = new mongoose.Schema({
    date: String,
    morningLiters: [Number],
    eveningLiters: [Number],
    pricePerLiter: Number,
    totalPrice: Number,
});

// Create a model
const Milk = mongoose.model('Milk', milkSchema);

// Google authentication
passport.use(new GoogleTokenStrategy({
    clientID: '772600296799-acupu3d25l1mmb8am12s87vjs6hu9no9.apps.googleusercontent.com',
}, async (accessToken, refreshToken, email, done) => {
    try {
        done(null, email.payload); // Pass user info to req.user
    } catch (error) {
        done(error);
    }
}));

// Route to authenticate with Google
app.post('/auth/google', async (req, res) => {
    console.log("Received request at /auth/google");
    const { idToken } = req.body;

    passport.authenticate('google-id-token', (err, user) => {
        if (err) {
            console.error('Authentication error:', err);
            return res.status(401).json({ error: 'Authentication failed', err });
        }
        res.status(200).json(user);
    })(req, res);
});

// Callback route for Google authentication
// Remove this in your backend
app.get('/auth/google/callback', (req, res) => {
  passport.authenticate('google-id-token', (err, user) => {
      if (err) {
          console.error('Authentication error:', err);
          return res.status(401).json({ error: 'Authentication failed', err });
      }
      // Just return a success response, no need to redirect
      res.status(200).json(user);
  })(req, res);
});


// Serve home route (for client-side routing)
app.get('/home', (req, res) => {
    res.send('Home Screen Loaded.'); // Can modify to integrate with React Native if necessary.
});

// Calculate endpoint
app.post('/api/calculate', async (req, res) => {
    const { date, morningLiters, eveningLiters, pricePerLiter } = req.body;
    const totalLiters = morningLiters.reduce((a, b) => a + b, 0) + eveningLiters.reduce((a, b) => a + b, 0);
    const totalPrice = totalLiters * pricePerLiter;

    const newMilkRecord = new Milk({
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
app.delete('/delete-bill/:id', async (req, res) => {
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

// History endpoint
app.get('/api/history', async (req, res) => {
    const history = await Milk.find();
    res.json(history);
});

// Dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
    const history = await Milk.find();
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
