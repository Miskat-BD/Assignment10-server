const express = require('express');
const app = express();
require('dotenv').config()
var cors = require('cors');
const port = 8000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!');
});


const uri = process.env.MONGO_DB_URI;

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

        const database = client.db(process.env.DB_NAME)
        const usersCollection = database.collection('user')
        const startupCollection = database.collection('startups')
        const opportunityCollection = database.collection('opportunities')

        app.get('/api/users', async (req, res) => {
            const cursor = usersCollection.find()
            const result = await cursor.toArray()
            res.json(result)
        })

        // startup apis
        app.get('/api/startups', async (req, res) => {
            const cursor = startupCollection.find()
            const result = await cursor.toArray()
            res.json(result)
        })

        app.get('/startup/:founderId', async (req, res) => {
            const founderId = req.params.founderId
            const result = await startupCollection.findOne({ founderId: founderId })
            res.json(result)
        })

        app.get('/api/startup/:startupId', async (req, res) => {
            const { startupId } = req.params
            const query = {
                _id: new ObjectId(startupId)
            }
            const result = await startupCollection.findOne(query)
            res.json(result)
        })

        app.patch('/api/startup/:startupId', async (req, res) => {
            const { startupId } = req.params;
            const updatedData = req.body;
            const query = { _id: new ObjectId(startupId) };
            const { _id, ...dataToUpdate } = updatedData;

            const result = await startupCollection.updateOne(query, {
                $set: dataToUpdate
            });

            res.json(result);
        })

        app.delete('/api/startup/:startupId', async (req, res) => {
            const { startupId } = req.params
            const query = {
                _id: new ObjectId(startupId)
            }
            const result = await startupCollection.deleteOne(query)
            res.json(result)
        })

        app.post('/startups', async (req, res) => {
            const startup = req.body
            const result = await startupCollection.insertOne(startup)
            res.json(result)
        })

        // opportunity apis
        app.post('/api/opportunity', async (req, res)=>{
            const data = req.body
            const result = await opportunityCollection.insertOne(data)
            res.json(result)
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});