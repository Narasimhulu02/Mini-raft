const express = require("express");

const app = express();
app.use(express.json());

const DEFAULT_PORT = 6003;
const PORT = Number(process.env.PORT || DEFAULT_PORT);
const NODE_URL = process.env.NODE_URL || `http://localhost:${PORT}`;
const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:5000";
const HEARTBEAT_INTERVAL_MS = 150;
const ELECTION_TIMEOUT_MIN_MS = 900;
const ELECTION_TIMEOUT_MAX_MS = 1800;
const ELECTION_BASE_PORT = 6001;
const ELECTION_NODE_OFFSET_MS = Math.max(0, PORT - ELECTION_BASE_PORT) * 1200;
const ELECTION_RETRY_BACKOFF_MS = 1500;
const FETCH_TIMEOUT_MS = 1200;

const replicaUrls = (process.env.REPLICA_URLS || "http://localhost:6001,http://localhost:6002,http://localhost:6003")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
const peerUrls = replicaUrls.filter((url) => url !== NODE_URL);

let role = "follower";
let currentTerm = 0;
let votedFor = null;
let leaderId = null;
let leaderUrl = null;
let logEntries = [];
let commitIndex = -1;
let electionDeadline = 0;
let electionInProgress = false;

function randomElectionTimeout() {
    return Math.floor(Math.random() * (ELECTION_TIMEOUT_MAX_MS - ELECTION_TIMEOUT_MIN_MS + 1)) + ELECTION_TIMEOUT_MIN_MS;
}

function resetElectionDeadline(extraDelayMs = 0) {
    electionDeadline = Date.now() + ELECTION_NODE_OFFSET_MS + randomElectionTimeout() + extraDelayMs;
}

function resetElectionDeadlineAfterFailure() {
    resetElectionDeadline(ELECTION_RETRY_BACKOFF_MS);
}

function localLastLogTerm() {
    if (logEntries.length === 0) {
        return 0;
    }
    return logEntries[logEntries.length - 1].term;
}

function localLastLogIndex() {
    return logEntries.length - 1;
}

function isCandidateLogUpToDate(lastLogIndex, lastLogTerm) {
    const myTerm = localLastLogTerm();
    const myIndex = localLastLogIndex();

    if (lastLogTerm > myTerm) {
        return true;
    }
    if (lastLogTerm < myTerm) {
        return false;
    }
    return lastLogIndex >= myIndex;
}

async function postJson(url, payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
    });

    clearTimeout(timeoutId);
    return res.json();
}

async function replicateEntryToFollower(peerUrl, index) {
    const entry = logEntries[index];
    const prevLogIndex = index - 1;
    const prevLogTerm = prevLogIndex >= 0 ? logEntries[prevLogIndex].term : 0;

    try {
        const response = await postJson(`${peerUrl}/append-entries`, {
            term: currentTerm,
            leaderId: NODE_URL,
            prevLogIndex,
            prevLogTerm,
            entries: [entry],
            leaderCommit: commitIndex
        });

        if (response.success) {
            return true;
        }

        if (typeof response.currentLogLength === "number") {
            await postJson(`${peerUrl}/sync-log`, {
                term: currentTerm,
                leaderId: NODE_URL,
                startIndex: response.currentLogLength,
                entries: logEntries.slice(response.currentLogLength),
                leaderCommit: commitIndex
            });
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

async function broadcastHeartbeat() {
    await Promise.all(
        peerUrls.map(async (peerUrl) => {
            try {
                await postJson(`${peerUrl}/heartbeat`, {
                    term: currentTerm,
                    leaderId: NODE_URL,
                    leaderCommit: commitIndex
                });
            } catch {
                // best effort heartbeat
            }
        })
    );
}

setInterval(() => {
    if (role !== "leader" && Date.now() > electionDeadline) {
        startElection();
    }
}, 50);

setInterval(() => {
    if (role === "leader") {
        broadcastHeartbeat();
    }
}, HEARTBEAT_INTERVAL_MS);

async function startElection() {
    if (electionInProgress || role === "leader") {
        return;
    }

    electionInProgress = true;
    role = "candidate";
    currentTerm += 1;
    votedFor = NODE_URL;
    leaderId = null;
    leaderUrl = null;
    resetElectionDeadline();

    let votes = 1;
    const majority = Math.floor(replicaUrls.length / 2) + 1;

    console.log(`[${PORT}] Election started for term ${currentTerm}`);

    await Promise.all(
        peerUrls.map(async (peerUrl) => {
            try {
                const vote = await postJson(`${peerUrl}/request-vote`, {
                    term: currentTerm,
                    candidateId: NODE_URL,
                    lastLogIndex: localLastLogIndex(),
                    lastLogTerm: localLastLogTerm()
                });

                if (vote.term > currentTerm) {
                    currentTerm = vote.term;
                    role = "follower";
                    votedFor = null;
                    resetElectionDeadlineAfterFailure();
                    return;
                }

                if (vote.voteGranted && role === "candidate") {
                    votes += 1;
                }
            } catch {
                // peer may be down during election
            }
        })
    );

    if (role === "candidate" && votes >= majority) {
        role = "leader";
        leaderId = NODE_URL;
        leaderUrl = NODE_URL;
        console.log(`[${PORT}] Became leader for term ${currentTerm}`);
        await broadcastHeartbeat();
    } else if (role === "candidate") {
        role = "follower";
        votedFor = null;
        resetElectionDeadlineAfterFailure();
    }

    electionInProgress = false;
}

app.post("/request-vote", (req, res) => {
    const {
        term,
        candidateId,
        lastLogIndex = -1,
        lastLogTerm = 0
    } = req.body;

    if (term < currentTerm) {
        return res.send({ term: currentTerm, voteGranted: false });
    }

    if (term > currentTerm) {
        currentTerm = term;
        role = "follower";
        votedFor = null;
        resetElectionDeadline();
    }

    const canVote = votedFor === null || votedFor === candidateId;
    const upToDate = isCandidateLogUpToDate(lastLogIndex, lastLogTerm);

    if (canVote && upToDate) {
        votedFor = candidateId;
        resetElectionDeadline();
        return res.send({ term: currentTerm, voteGranted: true });
    }

    return res.send({ term: currentTerm, voteGranted: false });
});

app.post("/append-entries", (req, res) => {
    const {
        term,
        leaderId: incomingLeaderId,
        prevLogIndex = -1,
        prevLogTerm = 0,
        entries = [],
        leaderCommit = -1
    } = req.body;

    if (term < currentTerm) {
        return res.send({ success: false, term: currentTerm, currentLogLength: logEntries.length });
    }

    if (term > currentTerm) {
        currentTerm = term;
        votedFor = null;
    }

    role = "follower";
    leaderId = incomingLeaderId;
    leaderUrl = incomingLeaderId;
    resetElectionDeadline();

    if (prevLogIndex >= 0) {
        if (prevLogIndex >= logEntries.length) {
            return res.send({ success: false, term: currentTerm, currentLogLength: logEntries.length });
        }

        if (logEntries[prevLogIndex].term !== prevLogTerm) {
            return res.send({ success: false, term: currentTerm, currentLogLength: prevLogIndex });
        }
    }

    for (let i = 0; i < entries.length; i += 1) {
        const writeIndex = prevLogIndex + 1 + i;
        const existing = logEntries[writeIndex];
        const incoming = entries[i];

        if (!existing) {
            logEntries.push(incoming);
            continue;
        }

        if (existing.term !== incoming.term) {
            logEntries = logEntries.slice(0, writeIndex);
            logEntries.push(incoming);
        }
    }

    if (leaderCommit > commitIndex) {
        commitIndex = Math.min(leaderCommit, logEntries.length - 1);
    }

    return res.send({ success: true, term: currentTerm, currentLogLength: logEntries.length });
});

app.post("/heartbeat", (req, res) => {
    const { term, leaderId: incomingLeaderId, leaderCommit = -1 } = req.body;

    if (term < currentTerm) {
        return res.send({ ok: false, term: currentTerm });
    }

    if (term > currentTerm) {
        currentTerm = term;
        votedFor = null;
    }

    role = "follower";
    leaderId = incomingLeaderId;
    leaderUrl = incomingLeaderId;
    resetElectionDeadline();

    if (leaderCommit > commitIndex) {
        commitIndex = Math.min(leaderCommit, logEntries.length - 1);
    }

    return res.send({ ok: true, term: currentTerm });
});

app.post("/sync-log", (req, res) => {
    const { term, leaderId: incomingLeaderId, startIndex = 0, entries = [], leaderCommit = -1 } = req.body;

    if (term < currentTerm) {
        return res.send({ success: false, term: currentTerm });
    }

    if (term > currentTerm) {
        currentTerm = term;
        votedFor = null;
    }

    role = "follower";
    leaderId = incomingLeaderId;
    leaderUrl = incomingLeaderId;
    resetElectionDeadline();

    logEntries = [...logEntries.slice(0, startIndex), ...entries];
    commitIndex = Math.min(leaderCommit, logEntries.length - 1);

    return res.send({ success: true, term: currentTerm, currentLogLength: logEntries.length });
});

app.post("/stroke", async (req, res) => {
    if (role !== "leader") {
        return res.status(409).send({
            error: "NOT_LEADER",
            leaderUrl,
            term: currentTerm
        });
    }

    const stroke = req.body;
    const entry = {
        term: currentTerm,
        stroke,
        ts: Date.now()
    };

    logEntries.push(entry);
    const newIndex = logEntries.length - 1;

    let acknowledgements = 1;
    const majority = Math.floor(replicaUrls.length / 2) + 1;

    const replications = await Promise.all(
        peerUrls.map((peerUrl) => replicateEntryToFollower(peerUrl, newIndex))
    );

    for (const replicated of replications) {
        if (replicated) {
            acknowledgements += 1;
        }
    }

    if (acknowledgements >= majority) {
        commitIndex = newIndex;

        try {
            await postJson(`${GATEWAY_URL}/commit`, {
                stroke,
                index: commitIndex,
                term: currentTerm,
                leaderId: NODE_URL
            });
        } catch {
            // gateway may be temporarily unavailable
        }

        return res.send({ committed: true, index: commitIndex, term: currentTerm, leaderUrl: NODE_URL });
    }

    return res.status(503).send({ committed: false, error: "MAJORITY_NOT_REACHED", term: currentTerm });
});

app.get("/status", (_req, res) => {
    res.send({
        nodeUrl: NODE_URL,
        role,
        currentTerm,
        leaderId,
        leaderUrl,
        commitIndex,
        logLength: logEntries.length
    });
});

app.get("/log", (_req, res) => {
    res.send({ commitIndex, entries: logEntries });
});

resetElectionDeadline();

app.listen(PORT, () => {
    console.log(`Replica running on ${PORT} (${NODE_URL})`);
});