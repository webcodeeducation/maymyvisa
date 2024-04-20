require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { MongoClient, ObjectId } = require('mongodb');

const JWT_SECRET = '3608320'; // This should be in an environment variable for production
const JWT_EXPIRES_IN = '2h'; // Token expiration time

const app = express();
//const s3 = new aws.S3();
const port = 3000;
const url = 'mongodb://localhost:27017';
const dbName = 'mapmyvisa';

//app.use(bodyParser.json());
app.use(cors());  // Enable CORS for all routes
app.use(bodyParser.json());

// AWS S3 configuration
aws.config.update({
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    region: process.env.AWS_REGION
});

const s3 = new aws.S3();
/*var upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'brandingkatalyst',
        acl: 'public-read',
        key: function (req, file, cb) {
            // Using the original file name, but consider adding a unique identifier (like a timestamp or a UUID)
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix);
        }
    })
});*/
/*var upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'brandingcatalyst',
        //acl: 'public-read',
        key: function (req, file, cb) {
			// Using the original file name, but consider adding a unique identifier (like a timestamp or a UUID)
            //const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            //cb(null, file.fieldname + '-' + uniqueSuffix);
			const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileExtension = file.originalname.split('.').pop();
            //cb(null, file.fieldname + '-' + uniqueSuffix + '.' + fileExtension); // To allow images Only
			cb(null, `${file.fieldname}-${uniqueSuffix}.${fileExtension}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // for example, limit file size to 10MB
    fileFilter: function (req, file, cb) {
        // You can use this function to filter out unwanted file types
        if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
            cb(new Error('Only images are allowed'));
        } else {
            cb(null, true);
        }
    }
}).single('file');*/  // Change this according to the expected field name of the file

var upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'brandingcatalyst',
        key: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileExtension = file.originalname.split('.').pop();
            cb(null, `${file.fieldname}-${uniqueSuffix}.${fileExtension}`);
        }
    }),
    limits: { fileSize: 100 * 1024 * 1024 }, // Increase limit to 100MB if videos are expected to be large
    fileFilter: function (req, file, cb) {
        // Updated file filter to include video MIME types
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only specific image and video formats are allowed'), false);
        }
    }
}).single('file');  // Assuming that file uploads will be handled one at a time

/*var upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'brandingcatalyst',
        key: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileExtension = file.originalname.split('.').pop();
            let folderName = '';
            // Determine the folder based on MIME type
            if (file.mimetype.startsWith('image/')) {
                folderName = 'images';
            } else if (file.mimetype.startsWith('video/')) {
                folderName = 'videos';
            }
            cb(null, `${folderName}/${file.fieldname}-${uniqueSuffix}.${fileExtension}`);
        }
    }),
    limits: { fileSize: 100 * 1024 * 1024 }, // Set the file size limit
    fileFilter: function (req, file, cb) {
        // File filter to allow specific image and video MIME types
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only specific image and video formats are allowed'), false);
        }
    }
}).single('file');*/  // Handle one file per request




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
	console.log(req.body)
    try {
        const user = await db.collection('users').findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign(
                { userId: user._id, username: user.username },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );
            res.json({status:true, message: 'Login successful!', token });
			// Encapsulating response within a 'data' object
            /*res.json({
                status: true,
                data: {
                    message: 'Login successful!',
                    token: token
                }
            });*/
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

// Middleware for handling multipart/form-data
/*const studentUpload = upload.fields([{ name: 'profilePic', maxCount: 1 }, { name: 'document', maxCount: 1 }]);

app.post('/students', authenticateToken, studentUpload, async (req, res) => {
    try {
        console.log(req.body);  // This will contain the text fields
        console.log(req.files); // This will contain files

        // Example of handling files: save the file URL in the database if needed
        const profilePicUrl = req.files['profilePic'] ? req.files['profilePic'][0].location : null;
        const documentUrl = req.files['document'] ? req.files['document'][0].location : null;

        // Creating a new student object including file URLs if available
        const newStudent = {
            name: req.body.name,
            age: req.body.age,
            profilePicUrl: profilePicUrl,
            documentUrl: documentUrl,
            // Add other student-related fields here
        };

        const result = await db.collection('students').insertOne(newStudent);
        res.status(201).json(result);
    } catch (error) {
        console.error("Failed to register student:", error);
        res.status(500).json({ message: "Failed to register student", error: error });
    }
});*/





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

//use by upload form
/*app.post('/upload123', upload.array('upl', 25), function (req, res, next) {
    res.send({
        message: "Uploaded!",
        urls: req.files.map(function(file) {
            return {url: file.location, name: file.key, type: file.mimetype, size: file.size};
        })
    });
});*/

// Then use this middleware in your route
app.post('/upload', (req, res) => {
  upload(req, res, function (error) {
    if (error) {
		console.log(error)
      // An error occurred when uploading (from multer)
      return res.status(500).json({ error: error.message });
    }
    
    // Everything went fine, multer-s3 handled the file upload to S3
    if (req.file) {
      res.json({
        message: "File uploaded successfully",
        url: req.file.location
      });
    } else {
      res.status(500).send("Failed to upload file.");
    }
  });
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
