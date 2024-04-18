const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');

const JWT_SECRET = '3608320'; // This should be in an environment variable for production
const JWT_EXPIRES_IN = '2h'; // Token expiration time

const app = express();
const port = 3000;
const url = 'mongodb://localhost:27017';
const dbName = 'mapmyvisa';

app.use(bodyParser.json());

const client = new MongoClient(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.get('/', (req, res) => {
    res.send('Welcome to our mapmyvisa API');
});

// Connect to MongoDB
async function main() {
    await client.connect();
    console.log('Connected successfully to database');
    const db = client.db(dbName);
	
	const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401); // if no token is found

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // if the token is not valid
        req.user = user;
        next();
    });
};

// Example of a protected route
app.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: "You have accessed a protected route!", user: req.user });
});
	
	app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = await db.collection('users').insertOne({
            username,
            password: hashedPassword
        });
        res.status(201).send(`User created with ID: ${result.insertedId}`);
    } catch (error) {
        res.status(400).json({ message: "Cannot register user", error });
    }
});

/*app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.collection('users').findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            // For simplicity, returning a simple message. In real scenarios, you should issue a token (like JWT).
            res.send('Login successful!');
        } else {
            res.status(401).send('Login failed!');
        }
    } catch (error) {
        res.status(500).json({ message: "Authentication failed", error });
    }
});*/

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.collection('users').findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign(
                { userId: user._id, username: user.username },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );
            res.json({ message: 'Login successful!', token });
        } else {
            res.status(401).send('Login failed!');
        }
    } catch (error) {
        res.status(500).json({ message: "Authentication failed", error });
    }
});


    // Routes
	// Protected Student Routes
app.post('/students', authenticateToken, async (req, res) => {
    console.log(req.body)
    const result = await db.collection('students').insertOne(req.body);
    res.status(201).json(result);
});

app.get('/students', authenticateToken, async (req, res) => {
    const students = await db.collection('students').find({}).toArray();
    res.json(students);
});

app.get('/students/:id', authenticateToken, async (req, res) => {
    const id = req.params.id;
    const student = await db.collection('students').findOne({_id: new ObjectId(id)});
    if (student) {
        res.json(student);
    } else {
        res.status(404).send('Student not found');
    }
});

app.put('/students/:id', authenticateToken, async (req, res) => {
    const id = req.params.id;
    const result = await db.collection('students').updateOne({_id: new ObjectId(id)}, {$set: req.body});
    res.json(result);
});

app.delete('/students/:id', authenticateToken, async (req, res) => {
    const id = req.params.id;
    const result = await db.collection('students').deleteOne({_id: new ObjectId(id)});
    if (result.deletedCount === 1) {
        res.status(204).send();
    } else {
        res.status(404).send('Student not found');
    }
});

// Hypothetical Protected User Route
app.get('/users', authenticateToken, async (req, res) => {
    const users = await db.collection('users').find({}).toArray();
    res.json(users);
});


    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
}

main().catch(console.error);
