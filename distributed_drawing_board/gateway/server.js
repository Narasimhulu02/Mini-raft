const express = require("express");
const http = require("http");
const cors = require("cors");
const WebSocket = require("ws");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = Number(process.env.PORT || 5000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 2000);
const replicaUrls = (process.env.REPLICA_URLS || "http://localhost:6001,http://localhost:6002,http://localhost:6003")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

let leaderUrl = null;
const clients = new Set();

function broadcastToClients(payload) {
    const serialized = JSON.stringify(payload);

    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(serialized);
        }
    }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function probeReplica(url) {
    try {
        const res = await fetchWithTimeout(`${url}/status`);
        if (!res.ok) {
            return null;
        }
        return await res.json();
    } catch {
        return null;
    }
}

async function discoverLeader() {
    for (const url of replicaUrls) {
        const status = await probeReplica(url);
        if (!status) {
            continue;
        }

        if (status.role === "leader") {
            leaderUrl = url;
            return leaderUrl;
        }

        if (status.leaderUrl) {
            leaderUrl = status.leaderUrl;
            return leaderUrl;
        }
    }

    leaderUrl = null;
    return null;
}

async function getHealthyLeader() {
    if (leaderUrl) {
        const cached = await probeReplica(leaderUrl);
        if (cached && cached.role === "leader") {
            return leaderUrl;
        }
        leaderUrl = null;
    }

    return discoverLeader();
}

async function sendStrokeToLeader(stroke, retries = 2) {
    let target = await getHealthyLeader();

    if (!target) {
        throw new Error("No leader available");
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const res = await fetchWithTimeout(`${target}/stroke`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(stroke)
            });

            if (res.ok) {
                const data = await res.json();
                if (data.leaderUrl) {
                    leaderUrl = data.leaderUrl;
                }
                return data;
            }

            const body = await res.json().catch(() => ({}));
            if ((res.status === 409 || body.error === "NOT_LEADER") && body.leaderUrl) {
                leaderUrl = body.leaderUrl;
                target = body.leaderUrl;
                continue;
            }
        } catch {
            // Try discovering a new leader on connection failures/timeouts.
        }

        leaderUrl = null;
        target = await discoverLeader();
        if (!target) {
            break;
        }
    }

    throw new Error("Failed to send stroke to leader");
}

wss.on("connection", (ws) => {
    clients.add(ws);
    console.log("Client connected. Total clients:", clients.size);

    ws.on("message", async (raw) => {
        try {
            const stroke = JSON.parse(String(raw));
            await sendStrokeToLeader(stroke);
        } catch (error) {
            ws.send(JSON.stringify({
                type: "error",
                message: "Stroke was not committed. Leader election in progress."
            }));
            console.log("Gateway failed to process stroke:", error.message);
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
    });
});

app.post("/commit", (req, res) => {
    const { stroke, index, term, leaderId } = req.body;

    if (!stroke) {
        return res.status(400).send({ error: "Missing stroke" });
    }

    broadcastToClients({
        type: "stroke",
        stroke,
        index,
        term,
        leaderId
    });

    return res.send({ ok: true });
});

app.get("/health", async (_req, res) => {
    const currentLeader = await getHealthyLeader();
    res.send({ ok: true, leaderUrl: currentLeader, replicas: replicaUrls });
});

server.listen(PORT, async () => {
    await discoverLeader();
    console.log(`Gateway running on port ${PORT}`);
});
