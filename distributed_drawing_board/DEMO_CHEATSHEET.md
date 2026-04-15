# Mini Raft Whiteboard - Quick Demo Cheat Sheet

## Before You Start
- Press `Ctrl+C` on any terminal to stop commands
- Keep multiple terminals open: one for compose, one for commands
- Browser should be ready to go to: http://localhost:8080

---

## The Commands (In Order)

### 1️⃣ Navigate to Project
```powershell
cd c:\Users\naras\OneDrive\Desktop\BTech\sem-6\CC\Mini_Project\distributed_drawing_board
```

### 2️⃣ Start Everything (PRIMARY TERMINAL)
```powershell
docker compose up --build
```
⏳ Wait for: `raft-replica1 | [6001] Became leader for term 1`

---

### 3️⃣ Check Health (SECONDARY TERMINAL - Keep First Running!)
```powershell
# Gateway health
Invoke-RestMethod http://localhost:5000/health | ConvertTo-Json

# All replicas (paste all 3 at once)
Invoke-RestMethod http://localhost:6001/status | ConvertTo-Json -Depth 3
Invoke-RestMethod http://localhost:6002/status | ConvertTo-Json -Depth 3
Invoke-RestMethod http://localhost:6003/status | ConvertTo-Json -Depth 3
```

✅ **What you should see:**
- Replica 1: `"role": "leader"`
- Replica 2 & 3: `"role": "follower"`

---

### 4️⃣ Open Browser
```
http://localhost:8080
```

✅ **What you should see:**
- Canvas on right
- Tool panel on left
- Status showing "Connected" (green)

---

### 5️⃣ Demo Drawing Tools
- Click **Pencil** button → draw on canvas
- Adjust **Thickness** slider → draw thicker line
- Click **Eraser** button → erase part of drawing
- Pick **Color** → draw in new color
- Click **Clear Board** → clear everything

---

### 6️⃣ Check Which Replica Is Leader Right Now

**In a terminal:**
```powershell
Invoke-RestMethod http://localhost:5000/health | ConvertTo-Json -Depth 5
```

**What to say:**
- The gateway shows the current leader.
- The UI also shows the leader name in the left panel.
- If leader is missing for a moment, it means RAFT election is happening.

**Example output:**
```json
{
	"leaderUrl": "http://replica3:6003"
}
```

Say: **Replica 3 is the current leader.**

---

### 7️⃣ (OPTIONAL) Kill Leader to Show Failover

**In a new terminal:**
```powershell
docker stop raft-replica3
```

Then check which replica is now leader:
```powershell
Invoke-RestMethod http://localhost:5000/health | ConvertTo-Json -Depth 5
```

You should see a new `leaderUrl` after election finishes.

Try drawing in UI → if the leader changed, the board should recover after election.

---

### 8️⃣ Restart That Replica
```powershell
docker start raft-replica3
```

---

### 9️⃣ Stop Everything (When Done)
```powershell
docker compose down
```

Verify:
```powershell
docker ps    # Should show no containers running
```

---

## Folder Explanations (Bullet Points for Teacher)

**fronted/**
- HTML page with canvas
- JavaScript that listens to mouse + sends strokes to gateway
- Always connects to `ws://localhost:5000`

**gateway/**
- WebSocket server (port 5000)
- Receives drawing strokes from browser
- Finds which replica is the RAFT leader
- Forwards stroke to leader
- Broadcasts committed strokes back to all clients

**replica1, replica2, replica3/**
- RAFT consensus nodes
- Elect a leader among themselves (automatic)
- Leader receives strokes from gateway
- Replicates to followers (agreement protocol)
- Only after majority confirms does leader mark stroke as "committed"
- All replicas serve at `/status` endpoint so gateway can check health

---

## Key Points to Mention

1. **Distributed:** No single point of failure
2. **Consensus:** Uses RAFT algorithm; automatically elects leader
3. **Real-time:** WebSocket for instant sync
4. **Modern UI:** Responsive, styled, tool-rich whiteboard
5. **Docker:** Containerized, reproducible, easy to demonstrate

---

## If Teacher Asks...

**"How does it ensure all replicas agree?"**
→ RAFT consensus: leader logs changes, sends to followers, waits for majority confirmation.

**"What happens if leader dies?"**
→ Run `docker stop raft-replica1` → other replicas automatically elect new leader (takes ~500ms). Clients reconnect via gateway → drawing continues.

**"Can multiple users draw together?"**
→ Yes, multiple browser tabs can open `http://localhost:8080` and all see each other's drawing in real-time.

**"Is this production-ready?"**
→ This is a teaching project. Real systems add persistence (disk/DB), more replicas, configuration management. But architecture is sound.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port already in use | `docker compose down` first |
| Containers won't start | Check Docker Desktop is running |
| `localhost:8080` shows 502 error | Wait 30 seconds, gateway might still booting |
| Drawing not syncing | Check status—if no leader, wait ~1 second for election |
| Can't connect to localhost | Run from the correct folder (check `pwd`) |

---

**Good luck! 🚀**
