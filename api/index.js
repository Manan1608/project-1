const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const User = require('./models/user');
const Message = require('./models/Message');
const ws = require('ws');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

// MongoDB connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log(' MongoDB connected'))
  .catch(err => console.error(' MongoDB error:', err));

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  credentials: true,
  origin: process.env.CLIENT_URL,
}));

// Health check
app.get('/test', (req, res) => {
  res.json('Server is running');
});

// Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Log entire request body to confirm key names
  console.log("Incoming registration request body:", req.body);

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({ username, password: hashedPassword });
    
    jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
      if (err) throw err;
      res.cookie('token', token, {
        sameSite: 'lax',
        secure: false,
      }).status(201).json({ id: createdUser._id });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});


// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const foundUser = await User.findOne({ username });
  if (!foundUser) return res.status(404).json('User not found');

  const passOk = bcrypt.compareSync(password, foundUser.password);
  if (!passOk) return res.status(401).json('Wrong credentials');

  jwt.sign({ userId: foundUser._id, username }, jwtSecret, {}, (err, token) => {
    if (err) throw err;
    res.cookie('token', token, {
      sameSite: 'lax',
      secure: false,
    }).json({ id: foundUser._id });
  });
});

// Profile
app.get('/profile', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json('No token');

  jwt.verify(token, jwtSecret, {}, (err, userData) => {
    if (err) return res.status(403).json('Invalid token');
    res.json(userData);
  });
});

// Logout
app.post('/logout', (req, res) => {
  res.cookie('token', '', {
    sameSite: 'lax',
    secure: false,
  }).json('ok');
});

// Start server
const server = app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});

// WebSocket setup
const wss = new ws.WebSocketServer({ server });

wss.on('connection', (socket, req) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;

  if (!token) return;

  jwt.verify(token, jwtSecret, {}, (err, userData) => {
    if (err) return;
    socket.userId = userData.userId;
    socket.username = userData.username;
  });

  socket.on('message', async (message) => {
    const data = JSON.parse(message);
    const { recipient, text, file } = data;

    if (!socket.userId) return;

    const messageDoc = await Message.create({
      sender: socket.userId,
      recipient,
      text,
      file,
    });

    // Send to recipient only
    [...wss.clients].forEach(client => {
      if (client.userId === recipient && client.readyState === ws.OPEN) {
        client.send(JSON.stringify({
          text,
          sender: socket.userId,
          recipient,
          file,
          _id: messageDoc._id,
        }));
      }
    });
  });
});
