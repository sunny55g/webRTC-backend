require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// MongoDB
const mongoClient = new MongoClient(process.env.MONGO_URI);
let messagesCollection;

async function connectToMongo() {
    try {
        await mongoClient.connect();
        const db = mongoClient.db("chatDB");
        messagesCollection = db.collection("messages");
        console.log("✅ MongoDB connected");
    } catch (err) {
        console.error("❌ MongoDB connection failed:");
        console.error(err.stack);
        process.exit(1);
    }
}

connectToMongo();

app.get('/messages', async (req, res) => {
    if (!messagesCollection) return res.status(500).send("MongoDB not ready");
    const messages = await messagesCollection.find().sort({ timestamp: 1 }).toArray();
    res.json(messages);
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Map();
let clientIdCounter = 1;

wss.on('connection', (ws) => {
    const clientId = clientIdCounter++;
    const clientData = { id: clientId, name: `User${clientId}`, target: null };
    clients.set(ws, clientData);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            const client = clients.get(ws);

            switch (data.type) {
                case 'init':
                    // Prevent name reuse
                    for (let [otherWs, otherClient] of clients.entries()) {
                        if (otherClient.name === data.name && otherWs !== ws) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: 'Name already in use. Please choose another.'
                            }));
                            ws.close();
                            return;
                        }
                    }

                    // Save client details
                    client.name = data.name;
                    client.target = `${data.targetIP}:${data.targetPort}`;
                    console.log(`✅ ${client.name} connected (targeting ${client.target})`);

                    ws.send(JSON.stringify({
                        type: 'init',
                        name: 'Server',
                        isServer: true
                    }));

                    // Check for matching peer
                    for (let [otherWs, otherClient] of clients.entries()) {
                        if (
                            otherWs !== ws &&
                            otherClient.name === client.target &&
                            otherClient.target === client.name
                        ) {
                            console.log(`🔁 Matched: ${client.name} ↔ ${otherClient.name}`);
                            // Optionally notify both clients they are matched
                        }
                    }
                    break;

                case 'message':
                    console.log(`💬 ${client.name} → ${client.target}: ${data.content}`);
                    if (messagesCollection) {
                        await messagesCollection.insertOne({
                            sender: client.name,
                            content: data.content,
                            target: client.target,
                            timestamp: new Date()
                        });
                    }

                    for (let [otherWs, otherClient] of clients.entries()) {
                        if (
                            otherWs !== ws &&
                            otherClient.target === client.target &&
                            otherWs.readyState === WebSocket.OPEN
                        ) {
                            otherWs.send(JSON.stringify({
                                type: 'message',
                                sender: client.name,
                                content: data.content,
                                timestamp: new Date()
                            }));
                        }
                    }
                    break;
case 'signal':
    // Relay signaling to the client whose name matches this client's target
    for (let [otherWs, otherClient] of clients.entries()) {
        if (
            otherClient.name === client.target &&
            otherWs.readyState === WebSocket.OPEN
        ) {
            console.log(`📨 Relaying signal from ${client.name} to ${otherClient.name}`);
            otherWs.send(JSON.stringify({
                type: 'signal',
                from: client.name,
                data: data.data
            }));
        }
    }
    break;


                default:
                    console.warn('Unknown message type:', data.type);
            }
        } catch (err) {
            console.error("❌ Error handling message:", err);
        }
    });

    ws.on('close', () => {
        const client = clients.get(ws);
        console.log(`❌ ${client.name} disconnected`);
        clients.delete(ws);
    });

    ws.send(JSON.stringify({
        type: 'init',
        name: 'Server',
        isServer: true
    }));
});

function broadcastMessage(sender, message) {
    clients.forEach((_, ws) => {
        if (ws !== sender && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    });
}

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
