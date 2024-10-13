const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Replace the <username>, <password>, and <dbname> in the URL with your actual MongoDB Atlas values.
const mongoUri = 'mongodb+srv://sivbill_company:siva1222@cluster0.le65a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB connection error: ', err));

// Define a schema for the milk bill data
const milkSchema = new mongoose.Schema({
  date: String,
  totalLiters: Number,
  totalAmount: Number,
});

const MilkBill = mongoose.model('MilkBill', milkSchema);

// API to get all milk bill records
app.get('/history', async (req, res) => {
  const bills = await MilkBill.find();
  res.json(bills);
});

// API to create a new bill entry
app.post('/add-bill', async (req, res) => {
  const { date, totalLiters, totalAmount } = req.body;
  const newBill = new MilkBill({ date, totalLiters, totalAmount });
  await newBill.save();
  res.json(newBill);
});

// API to get a summary for the dashboard
app.get('/dashboard', async (req, res) => {
  const bills = await MilkBill.find();
  const totalLiters = bills.reduce((sum, bill) => sum + bill.totalLiters, 0);
  const totalAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
  res.json({ totalLiters, totalAmount });
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
