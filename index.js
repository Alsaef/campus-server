const express = require('express')
const cors = require('cors')
const bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
const cookieparser = require('cookie-parser')
require('dotenv').config()
const app = express()
const port = 3000

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}))
app.use(express.json())

app.use(cookieparser())








const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB}:${process.env.password}@cluster0.hwuf8vx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();



        const DB = client.db('lost-foundDB')

        const usersCollection = DB.collection('users')
        const lostFoundCollection = DB.collection('lostFound')

        const verifyToken = (req, res, next) => {


            try {
                const token = req?.cookies?.adminToken; // cookie থেকে token নেওয়া হচ্ছে

                if (!token) {
                    return res.status(401).send({ message: 'unauthorized access' });
                }
                const decoded = jwt.verify(token, process.env.Secret_Token);
                req.user = decoded;
                next();
            } catch (err) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
        };

        // app.post('/register', async (req, res) => {
        //     const { username, password } = req.body;

        //     if (!username || !password) {
        //         return res.status(400).json({ message: 'Username and password required' });
        //     }
        //     try {

        //         const hasPassword=await bcrypt.hash(password,10)
        //         const result = await usersCollection.insertOne({ username, password:hasPassword });
        //         res.status(201).json({ message: 'User registered', userId: result.insertedId });
        //     } catch (err) {
        //         res.status(500).json({ message: 'Registration failed', error: err.message });
        //     }
        // });



        app.post('/login', async (req, res) => {
            try {
                const { username, password } = req.body

                const user = await usersCollection.findOne({ username: username })

                const isPassword = await bcrypt.compare(password, user.password)

                if (!user) {
                    return res.status(401).send({ message: "Invalid username" });
                }

                if (!isPassword) {
                    return res.status(401).json({ message: 'invalid username or password' })
                }


                if (user.role !== 'admin') {
                    return res.status(401).json({ message: 'you are not admin' })
                }

                const token = jwt.sign(
                    { id: user._id, role: user.role, name: user.username, },
                    process.env.Secret_Token,
                    { expiresIn: '100d' }
                );

                res.cookie('adminToken', token, {
                    httpOnly: true,
                    secure: true,
                    maxAge: 100 * 24 * 60 * 60 * 1000,
                    sameSite: 'none'
                })

                console.log(token);

                res.status(200).json({ success: true })

            } catch (error) {
                res.status(500).json({ message: 'server error 500' })
            }
        })



        app.get("/me", verifyToken, (req, res) => {
            res.json({ id: req.user.id, role: req.user.role, name: req.user.name });
        });


        app.post('/logout', (req, res) => {
            res.clearCookie('adminToken');

            console.log('logout');
            res.send({ message: 'Logout successful' });
        });




        // post api lost and found

        app.post('/lost', async (req, res) => {
            try {
                const byData = req.body


                const result = await lostFoundCollection.insertOne(byData)


                res.send(200).json(result)


            } catch (error) {
                res.status(500).json({ message: 'server error 500' })
            }
        })

        app.post('/found', async (req, res) => {
            try {
                const byData = req.body


                const result = await lostFoundCollection.insertOne(byData)


                res.send(200).json(result)


            } catch (error) {
                res.status(500).json({ message: 'server error 500' })
            }
        })


        app.get('/items', async (req, res) => {
            try {
                const { search, type } = req.query;


                const query = {};

                if (search) {
                    query.$or = [
                        { itemName: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } },
                        { location: { $regex: search, $options: 'i' } }
                    ];
                }

                if (type) {
                    const validTypes = ['lost', 'found', 'claimed'];
                    if (validTypes.includes(type.toLowerCase())) {
                        query.type = type.toLowerCase();
                    } else {
                        return res.status(400).send({ message: 'Invalid type parameter' });
                    }
                }

                const items = await lostFoundCollection.find(query).toArray();
                res.send(items);

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: 'Server Error' });
            }
        });




        app.get('/lost-found', verifyToken, async (req, res) => {

            try {
                const { search } = req.query;


                const query = {};

                if (search) {
                    query.$or = [
                        { contact: { $regex: search, $options: 'i' } },
                    ];
                }



                const items = await lostFoundCollection.find(query).toArray();
                res.send(items);

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: 'Server Error' });
            }
        });

        app.patch('/claim/:id', verifyToken, async (req, res) => {
            try {
                const { id } = req.params;
                const update = {
                    $set: {
                        type: 'claimed',
                    }
                };
                const result = await lostFoundCollection.updateOne(
                    { _id: new ObjectId(id), type: { $ne: 'claimed' } },
                    update
                );
                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'Item not found or already claimed' });
                }
                res.json({ success: true, modifiedCount: result.modifiedCount });
            } catch (error) {
                res.status(500).json({ message: 'Server error 500' });
            }
        });



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
