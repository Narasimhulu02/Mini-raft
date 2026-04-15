# Mini Raft Whiteboard - Live Demonstration Guide

## Project Overview (Start Here)

**Name:** Distributed Drawing Board using Mini-RAFT Consensus  
**Purpose:** Build a collaborative real-time whiteboard where multiple users draw together, and a distributed RAFT consensus algorithm (leader + followers) ensures all replicas agree on the drawing state.

---

## Folder Structure Explanation

```
distributed_drawing_board/
├── fronted/              ← Static UI (what users see in browser)
│   ├── index.html        ← HTML page with drawing canvas + tool controls
│   ├── app.js            ← JavaScript: drawing logic, WebSocket client
│   └── Dockerfile        ← Docker config for nginx (web server)
│
├── gateway/              ← The "middleman" server (entry point for clients)
│   ├── server.js         ← WebSocket server that receives strokes from UI
│   │                        + finds & talks to the RAFT leader
│   ├── package.json      ← Dependencies (express, ws, cors)
│   └── Dockerfile
│
├── replica1/             ← RAFT Replica #1 (potential leader/follower)
├── replica2/             ← RAFT Replica #2 (potential leader/follower)
├── replica3/             ← RAFT Replica #3 (potential leader/follower)
│   Each contains:
│   ├── server.js         ← RAFT consensus logic
│   │   - Leader election
│   │   - Heartbeat broadcasting
│   │   - Log replication
│   ├── package.json
│   └── Dockerfile
│
└── docker-compose.yml    ← Orchestration file (starts all 6 containers)
```

### Key Point to Explain:
> **RAFT consensus ensures distributed agreement.** When a user draws, the stroke goes → gateway → leader replica → replicated to followers → committed → sent back to all clients.

---

## Ports Overview

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| **Frontend** | 8080 | http://localhost:8080 | User-facing whiteboard UI |
| **Gateway** | 5000 | http://localhost:5000 | WebSocket & leader discovery |
| **Replica 1** | 6001 | http://localhost:6001 | First consensus node (often leader) |
| **Replica 2** | 6002 | http://localhost:6002 | Second consensus node |
| **Replica 3** | 6003 | http://localhost:6003 | Third consensus node |

---

## Step-by-Step Demonstration

### **Part 1: Explain the Code Architecture (5 min)**

1. Open VSCode explorer and show each folder:
   ```
   Project Structure:
   - fronted/     → User Interface (HTML + Canvas JavaScript)
   - gateway/     → API Gateway (WebSocket entry point)
   - replica1,2,3 → Distributed consensus nodes (RAFT)
   ```

2. Show `fronted/app.js` briefly:
   ```javascript
   // Key line to highlight:
   const socket = new WebSocket("ws://localhost:5000");
   // This connects the UI to the gateway
   ```

3. Show `gateway/server.js` key snippet:
   ```javascript
   // Gateway discovers the RAFT leader and forwards strokes to it
   async function sendStrokeToLeader(stroke) {
       const target = leaderUrl || (await discoverLeader());
       // Sends stroke to whichever replica is the leader
   }
   ```

4. Show `replica1/server.js` key snippet:
   ```javascript
   // Each replica implements RAFT consensus
   // Leader elections happen automatically
   // Followers sync with leader's heartbeats
   ```

---

### **Part 2: Start All Services (3 min)**

**Tell your teacher:** "Now I'll start all services using Docker Compose, which will spin up:
- 3 RAFT consensus nodes (replicas)
- 1 API Gateway
- 1 Frontend web server"

**Run this command:**
```powershell
cd c:\Users\naras\OneDrive\Desktop\BTech\sem-6\CC\Mini_Project\distributed_drawing_board
docker compose up --build
```

**What to explain while waiting:**
- Docker is building container images for each service
- Replicas start first and hold elections to pick a leader
- Gateway waits for replicas to be healthy before starting
- Frontend starts last and only after gateway is ready

**Expected output signs:**
```
✓ All 5 images built
✓ Containers starting...
raft-replica1 | [6001] Election started for term 1
raft-replica1 | [6001] Became leader for term 1    ← One replicas wins
raft-replica2 | Follower
raft-replica3 | Follower
raft-gateway | Gateway running on port 5000
raft-fronted | nginx ready
```

---

### **Part 3: Health Check & Architecture Verification (2 min)**

**Tell your teacher:** "Let me verify all services are healthy and show you the RAFT consensus status."

**In a NEW terminal, run these WHILE the first is still running:**

```powershell
cd c:\Users\naras\OneDrive\Desktop\BTech\sem-6\CC\Mini_Project\distributed_drawing_board

# Check Gateway Health
Invoke-RestMethod http://localhost:5000/health | ConvertTo-Json -Depth 5

# Check Each Replica Status
Invoke-RestMethod http://localhost:6001/status | ConvertTo-Json -Depth 5
Invoke-RestMethod http://localhost:6002/status | ConvertTo-Json -Depth 5
Invoke-RestMethod http://localhost:6003/status | ConvertTo-Json -Depth 5
```

**What to point out from the output:**

```json
{
  "role": "leader",
  "currentTerm": 1,
  "leaderId": "http://replica1:6001"
}
```

**Say:** "Notice how:
- Replica 1 is the **leader** (elected through RAFT)
- Replica 2 and 3 are **followers** (synced with leader)
- All 3 replicas are on **term 1** (consensus epoch)"

---

### **Part 4: Open the UI in Browser (2 min)**

**Tell your teacher:** "Now let's open the whiteboard UI in the browser."

**Do this:**
1. Open browser: http://localhost:8080
2. Show the enhanced UI:
   - Left panel with tool controls
   - Right side: large canvas for drawing
   - **Pencil** button (selected by default)
   - **Eraser** button
   - **Thickness** slider (1-40 px)
   - **Color picker** (for pencil)
   - **Clear Board** button
   - **Status indicator** showing "Connected"

**Explain:** "The UI connects via WebSocket to the gateway, which finds the RAFT leader and syncs all strokes. The UI is styled like a modern web app with gradient background and glassmorphism design."

---

### **Part 5: Live Drawing Demo (3 min)**

**Tell your teacher:** "Let me draw something to show the system in action."

**Do this:**
1. Click on the canvas with **Pencil** selected
2. Draw a simple shape (e.g., triangle or circle)
3. Show the thickness slider:
   - Drag it to a larger value
   - Draw another shape thicker
4. Switch to **Eraser**:
   - Erase part of the drawing
5. Change color with color picker:
   - Pick a new color
   - Draw something in that color
6. Press **Clear Board**:
   - Demonstrate the clear button works

**Behind the scenes (explain while drawing):**
```
User draws → Canvas events fire → App sends stroke to gateway via WebSocket
   ↓
Gateway receives stroke → Queries: "Who is the leader?"
   ↓
Gateway sends stroke to leader replica
   ↓
Leader receives stroke → Logs it → Replicates to followers (via /append-entries)
   ↓
Followers acknowledge → Leader considers it "committed"
   ↓
Leader broadcasts to ALL clients via gateway
   ↓
All connected users see the stroke appear on their canvas
```

---

### **Part 6: RAFT Consensus Demo (Optional - 5 min)**

**Tell your teacher:** "Let me demonstrate that the system is truly distributed. I'll stop the current leader and show that a NEW leader is automatically elected."

**While drawing is still possible:**

1. In the compose terminal, press `Ctrl+C` to stop the compose (but DON'T dispose)
   
2. Or in a new terminal, **kill the leader container only:**
   ```powershell
   docker stop raft-replica1
   ```

3. **Explain:** "The leader (replica1) is down. The other two replicas will immediately notice the leader's silence and start an election."

4. **Check the new leader:**
   ```powershell
   # In a new terminal
   Invoke-RestMethod http://localhost:6002/status | ConvertTo-Json -Depth 5
   ```

5. **Expected output:**
   ```json
   {
     "role": "leader",
     "currentTerm": 2,    ← Term incremented!
     "leaderId": "http://replica2:6002"  ← NEW leader!
   }
   ```

6. **Point out in UI:**
   - The UI might show "Disconnected" briefly
   - Then "Connected" again (gateway found new leader)
   - Try drawing again → it works!

7. **Restart the original leader:**
   ```powershell
   docker start raft-replica1
   ```

---

### **Part 7: Stop Everything (1 min)**

**Tell your teacher:** "Let me clean up all running services."

**Run:**
```powershell
docker compose down
```

**Output:**
```
[+] Stopping 5 containers
[+] Removing containers
[+] Removing network
```

---

## Talking Points for Your Teacher

### 1. **Distributed Consensus Why?**
   - If one server crashes, the system keeps working
   - All replicas stay in sync
   - No single point of failure

### 2. **RAFT Algorithm Highlights**
   - **Leader Election:** Replicas automatically pick a leader
   - **Log Replication:** Leader sends updates to followers
   - **Commit Protocol:** Waits for majority acknowledgment before committing

### 3. **Layered Architecture**
   - **Gateway:** Abstracts which replica is the leader (clients don't care)
   - **Replicas:** Handle consensus; clients never talk to them directly
   - **Frontend:** Modern, responsive UI with real-time sync

### 4. **WebSocket Real-Time Sync**
   - Strokes sent immediately (no polling)
   - Low latency drawing experience
   - Scalable to many concurrent users

### 5. **Docker Containerization**
   - Each service runs in its own container
   - Easy to start/stop/scale
   - Reproducible across machines

---

## Quick Command Reference (for answering teacher questions)

```powershell
# Start everything
docker compose up --build

# Stop everything
docker compose down

# Check gateway health
Invoke-RestMethod http://localhost:5000/health | ConvertTo-Json -Depth 5

# Check all replica status
1..3 | ForEach-Object { 
    $port = 6000 + $_
    Write-Output "=== Replica $_ (port $port) ==="
    Invoke-RestMethod http://localhost:$port/status | ConvertTo-Json -Depth 5
}

# View logs from a specific container (while running)
docker logs raft-replica1 -f
docker logs raft-gateway -f

# Stop just the leader
docker stop raft-replica1

# Restart stopped container
docker start raft-replica1
```

---

## Timing Summary

- **Explanation (Parts 1):** 5 min
- **Start Services (Part 2):** 3 min
- **Health Checks (Part 3):** 2 min
- **Open UI (Part 4):** 2 min
- **Live Demo (Part 5):** 3 min
- **Failover Demo (Part 6):** 5 min *(optional)*
- **Cleanup (Part 7):** 1 min

**Total:** ~15-20 minutes (without failover demo)

---

## Tips for Smooth Demonstration

1. **Before you start:**
   - Clear all Docker images and restart desktop to avoid conflicts
   - Open VSCode with the project folder
   - Have the PowerShell terminal ready
   - Open browser (but don't navigate yet)

2. **During demo:**
   - Talk through each step BEFORE running the command
   - Point at the output and explain what it means
   - Use analogies: "It's like a group taking a vote—the majority decides"

3. **If something breaks:**
   - Run `docker compose down` to clean up
   - Run `docker system prune` to remove dangling images
   - Restart: `docker compose up --build`

4. **To show logs (if teacher asks what's happening):**
   ```powershell
   docker logs raft-replica1 -f    # Follow logs in real-time
   docker logs raft-gateway -f
   ```

5. **Keep a backup browser tab open** to http://localhost:8080 just in case

---

Good luck with your demo! 🎨✨
