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
        const subscriptionCollection = database.collection('subscription')
        const applicationCollection = database.collection('applications')

        app.get('/api/users', async (req, res) => {
            const cursor = usersCollection.find()
            const result = await cursor.toArray()
            res.json(result)
        })

        // subscription apis
        app.post('/api/subscription', async (req, res) => {
            const { sessionId, userEmail, priceId, userId } = req.body
            const isExist = await subscriptionCollection.findOne({ sessionId })
            if (isExist) {
                return res.json({ msg: "Already Exist" })
            }
            const subscription = await subscriptionCollection.insertOne({ sessionId, userId, userEmail, priceId, paidAt: new Date() })
            const update = await usersCollection.updateOne(
                { email: userEmail },
                {
                    $set: {
                        plan: 'premium'
                    }
                }
            )
            res.json(update)
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
        app.get('/api/opportunity', async (req, res) => {
            const cursor = opportunityCollection.find()
            const result = await cursor.toArray()
            res.json(result)
        })

        app.get('/api/opportunity/:id', async (req, res) => {
            const { id } = req.params;
            const query = {
                _id: new ObjectId(id)
            }
            const result = await opportunityCollection.findOne(query)
            // const result = await cursor.toArray()
            res.json(result)
        })

        app.get('/api/opportunity/:startup_id', async (req, res) => {
            try {
                const { startup_id } = req.params;
                const cursor = opportunityCollection.find({ startup_id: startup_id });
                const result = await cursor.toArray();
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        app.post('/api/opportunity', async (req, res) => {
            try {
                const data = req.body;

                if (data.startup_id && typeof data.startup_id === 'object') {
                    data.startup_id = data.startup_id.toString();
                }

                const result = await opportunityCollection.insertOne(data);

                if (result.acknowledged) {
                    res.json({ success: true, data: result });
                } else {
                    res.json({ success: false, message: "Failed to insert into database" });
                }
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });

        app.patch('/api/opportunity/:id', async (req, res) => {
            const { id } = req.params
            const updatedData = req.body
            const { _id, ...dataToUpdate } = updatedData
            const query = {
                _id: new ObjectId(id)
            }
            const result = await opportunityCollection.updateOne(query, {
                $set: dataToUpdate
            })
            res.json(result)
        })
        app.delete('/api/opportunity/:id', async (req, res) => {
            const { id } = req.params
            const query = {
                _id: new ObjectId(id)
            }
            const result = await opportunityCollection.deleteOne(query)
            res.json(result)
        })

        // applications apis
        app.get('/api/applications/check', async (req, res) => {
            const { opportunityId, email } = req.query;
            if (!opportunityId || !email) {
                return res.status(400).json({ error: "Missing parameters" });
            }

            const isApplied = await applicationCollection.findOne({
                Opportunity_id: opportunityId,
                Applicant_email: email
            });

            res.json({ hasApplied: !!isApplied });
        });

        app.post('/api/applications', async (req, res) => {
            const data = req.body;

            const isExist = await applicationCollection.findOne({
                Opportunity_id: data.Opportunity_id,
                Applicant_email: data.Applicant_email
            });

            if (isExist) {
                return res.status(400).json({ success: false, message: "Already Applied" });
            }

            const newData = {
                ...data,
                appliedAt: new Date()
            };
            const result = await applicationCollection.insertOne(newData);
            res.json(result);
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


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});