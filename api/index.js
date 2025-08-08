const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const fs = require('fs');
const path = require('path');
const ws = require('ws');

const User = require('./models/User');
const Message = require('./models/Message');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

// DB connect
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// middlewares
app.use(express.json({ limit: '10mb' })); // increase payload limit for base64 file uploads
app.use(cookieParser());
app.use(cors({
  credentials: true,
  origin: process.env.CLIENT_URL, // Make sure this exactly matches your React app URL
}));

// uploads dir
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

// Root route
app.get('/', (req, res) => {
  res.send('Backend is running ');
});

// health
app.get('/test', (req, res) => res.json('Server is running'));

// helpers
function getUserFromRequest(req) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret);
  } catch (e) {
    return null;
  }
}

// Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ error: 'Username already taken.' });

    const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({ username, password: hashedPassword });

    jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
      if (err) throw err;
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
      .status(201)
      .json({ id: createdUser._id, username: createdUser.username }); // username included
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
  if (!foundUser) return res.status(404).json({ error: 'User not found' });

  const passOk = bcrypt.compareSync(password, foundUser.password);
  if (!passOk) return res.status(401).json({ error: 'Wrong credentials' });

  jwt.sign({ userId: foundUser._id, username }, jwtSecret, {}, (err, token) => {
    if (err) throw err;
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    .json({ id: foundUser._id, username: foundUser.username }); // username included
  });
});

// Profile
app.get('/profile', (req, res) => {
  const userData = getUserFromRequest(req);
  if (!userData) return res.status(401).json({ error: 'No token or invalid' });
  // Return only userId and username for frontend context
  res.json({ userId: userData.userId, username: userData.username });
});

// Logout
app.post('/logout', (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  }).json('ok');
});

// People list (all users)
app.get('/people', async (req, res) => {
  const users = await User.find({}, 'username _id'); // Only username and _id fields
  res.json(users);
});

// Messages between logged-in user and :userId
app.get('/messages/:userId', async (req, res) => {
  const userData = getUserFromRequest(req);
  if (!userData) return res.status(401).json({ error: 'Not authenticated' });
  const myId = userData.userId;
  const otherId = req.params.userId;

  const messages = await Message.find({
    $or: [
      { sender: myId, recipient: otherId },
      { sender: otherId, recipient: myId }
    ]
  }).sort({ createdAt: 1 });

  res.json(messages);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start server
const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// WebSocket server
const wss = new ws.WebSocketServer({ server });
const onlineMap = new Map(); // userId -> username

function broadcastOnlinePeople() {
  const onlineArray = [...onlineMap.entries()].map(([userId, username]) => ({ userId, username }));
  [...wss.clients].forEach(client => {
    if (client.readyState === ws.OPEN) client.send(JSON.stringify({ online: onlineArray }));
  });
}

wss.on('connection', (socket, req) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;
  if (!token) {
    socket.close();
    return;
  }

  try {
    const userData = jwt.verify(token, jwtSecret);
    socket.userId = userData.userId;
    socket.username = userData.username;

    // add to online map and broadcast
    onlineMap.set(socket.userId, socket.username);
    broadcastOnlinePeople();
  } catch (err) {
    socket.close();
    return;
  }

  socket.on('message', async (message) => {
    let data;
    try { data = JSON.parse(message); } catch (e) { return; }
    const { recipient, text, file } = data;

    if (!socket.userId) return;

    // handle file (dataURL base64)
    let storedFileName = null;
    if (file && file.data) {
      const matches = file.data.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const ext = path.extname(file.name) || '';
        storedFileName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
        const buffer = Buffer.from(matches[2], 'base64');
        fs.writeFileSync(path.join(uploadDir, storedFileName), buffer);
      }
    }

    const messageDoc = await Message.create({
      sender: socket.userId,
      recipient,
      text,
      file: storedFileName,
    });

    // send to recipient(s) and sender (so both see message instantly)
    [...wss.clients].forEach(client => {
      if (client.readyState === ws.OPEN) {
        if (client.userId === recipient || client.userId === socket.userId) {
          client.send(JSON.stringify({
            text,
            sender: socket.userId,
            recipient,
            file: storedFileName,
            _id: messageDoc._id,
            createdAt: messageDoc.createdAt,
          }));
        }
      }
    });
  });

  socket.on('close', () => {
    // check if this user still has other active sockets
    const stillConnected = [...wss.clients].some(c => c !== socket && c.userId === socket.userId);
    if (!stillConnected) {
      onlineMap.delete(socket.userId);
      broadcastOnlinePeople();
    }
  });

  // send initial online list to the connected socket
  socket.send(JSON.stringify({ online: [...onlineMap.entries()].map(([userId, username]) => ({ userId, username })) }));
});
