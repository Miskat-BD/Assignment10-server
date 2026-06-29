const express = require('express');
const app = express();
require('dotenv').config()
var cors = require('cors');
const port = 8000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

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


const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);


// async function run() {
//     try {
//         // Connect the client to the server	(optional starting in v4.7)
//         await client.connect();
client.connect(() => {
    console.log('connecting to MOngo db');
}).catch(console.dir)

const database = client.db(process.env.DB_NAME)
const usersCollection = database.collection('user')
const startupCollection = database.collection('startups')
const opportunityCollection = database.collection('opportunities')
const subscriptionCollection = database.collection('subscription')
const applicationCollection = database.collection('applications')
const sessionCollection = database.collection('session');

const verifyToken = async (req, res, next) => {

    const authHeader = req.headers?.authorization;
    // console.log(authHeader);
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    const token = authHeader.split(' ')[1]

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    const query = { token: token }
    const session = await sessionCollection.findOne(query);

    if (!session) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    const userId = session.userId;


    const userQuery = {
        _id: userId
    }

    const user = await usersCollection.findOne(userQuery);
    if (!user) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    // set data in the req object
    req.user = user;
    next();
}

app.get('/api/users', verifyToken, async (req, res) => {
    const cursor = usersCollection.find()
    const result = await cursor.toArray()
    res.json(result)
})

app.get('/api/users/:id', async (req, res) => {
    const { id } = req.params
    const query = {
        _id: new ObjectId(id)
    }
    const result = await usersCollection.findOne(query)
    res.json(result)
})

app.patch('/api/users/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body
    const query = {
        _id: new ObjectId(id)
    }
    const { _id, ...updateToData } = updatedData
    const result = await usersCollection.updateOne(query, {
        $set: updateToData
    })
    res.json(result)
})
app.patch('/api/users/:id/status', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const query = { _id: new ObjectId(id) };

    const result = await usersCollection.updateOne(query, {
        $set: {
            status: status
        }
    });

    res.json(result);
});

// transaction apis
app.get('/api/transaction', verifyToken, async (req, res) => {
    const cursor = subscriptionCollection.find().sort({ _id: -1 })
    const result = await cursor.toArray()
    res.json(result)

})

// subscription apis
app.post('/api/subscription', verifyToken, async (req, res) => {
    const { sessionId, userName, userEmail, priceId, userId } = req.body
    const isExist = await subscriptionCollection.findOne({ sessionId })
    if (isExist) {
        return res.json({ msg: "Already Exist" })
    }
    const subscription = await subscriptionCollection.insertOne({ sessionId, userName, userId, userEmail, amount: 29.99, priceId, paidAt: new Date() })
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

app.get('/startup/:founderId', verifyToken, async (req, res) => {
    const founderId = req.params.founderId
    const result = await startupCollection.findOne({ founderId: founderId })
    res.json(result)
})

app.get('/api/startup/:startupId', verifyToken, async (req, res) => {
    const { startupId } = req.params
    const query = {
        _id: new ObjectId(startupId)
    }
    const result = await startupCollection.findOne(query)
    res.json(result)
})

app.patch('/api/startup/:startupId', verifyToken, async (req, res) => {
    const { startupId } = req.params;
    const updatedData = req.body;
    const query = { _id: new ObjectId(startupId) };
    const { _id, ...dataToUpdate } = updatedData;

    const result = await startupCollection.updateOne(query, {
        $set: dataToUpdate
    });

    res.json(result);
})

app.patch('/api/startup/:id/status', verifyToken, async (req, res) => {
    const { id } = req.params
    const { status } = req.body
    const query = {
        _id: new ObjectId(id)
    }
    const result = await startupCollection.updateOne(query, {
        $set: {
            status: status
        }
    })
    res.json(result)
})

app.delete('/api/startup/:startupId', verifyToken, async (req, res) => {
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
    try {
        const { page = 1, limit = 6, search = "", workType = "" } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        let query = {};

        if (search) {
            query.$or = [
                { role_title: { $regex: search, $options: "i" } },
                { required_skills: { $regex: search, $options: "i" } }
            ];
        }

        if (workType) {
            const workTypeArray = workType.split(',');
            query.work_type = { $in: workTypeArray };
        }

        const cursor = opportunityCollection.find(query).skip(skip).limit(Number(limit));
        const result = await cursor.toArray();

        const totalData = await opportunityCollection.countDocuments(query);
        const totalPages = Math.ceil(totalData / Number(limit));

        res.json({ opportunities: result, page: Number(page), totalPages, totalData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.get('/api/opportunity/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const query = {
        _id: new ObjectId(id)
    }
    const result = await opportunityCollection.findOne(query)
    // const result = await cursor.toArray()
    res.json(result)
})

app.get('/api/opportunity/startup/:startup_id', async (req, res) => {
    try {
        const { startup_id } = req.params;
        const cursor = opportunityCollection.find({ startup_id: startup_id });
        const result = await cursor.toArray();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/opportunity', verifyToken, async (req, res) => {
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

app.patch('/api/opportunity/:id', verifyToken, async (req, res) => {
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
app.delete('/api/opportunity/:id', verifyToken, async (req, res) => {
    const { id } = req.params
    const query = {
        _id: new ObjectId(id)
    }
    const result = await opportunityCollection.deleteOne(query)
    res.json(result)
})

// applications apis
app.get('/api/application/:applicantEmail', async (req, res) => {
    const { applicantEmail } = req.params
    const query = {
        Applicant_email: applicantEmail
    }
    const cursor = applicationCollection.find(query)
    const result = await cursor.toArray()
    res.json(result)
})

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

app.get('/api/applications/startup/:startupId', async (req, res) => {
    const { startupId } = req.params
    const query = {
        Startup_id: startupId
    }
    const cursor = await applicationCollection.find(query).sort({ _id: -1 })
    const result = await cursor.toArray()
    res.json(result)
})

app.post('/api/applications', verifyToken, async (req, res) => {
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

app.patch(`/application/:id`, verifyToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ success: false, message: "Status is required" });
    }

    const query = {
        _id: new ObjectId(id)
    };

    const result = await applicationCollection.updateOne(query, {
        $set: {
            Status: status
        }
    });

    res.json(result);
});


//         // Send a ping to confirm a successful connection
//         // await client.db("admin").command({ ping: 1 });
//         console.log("Pinged your deployment. You successfully connected to MongoDB!");
//     } finally {
//         // Ensures that the client will close when you finish/error
//         // await client.close();
//     }
// }
// run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

module.exports = app;