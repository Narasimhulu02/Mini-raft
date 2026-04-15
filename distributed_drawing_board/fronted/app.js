const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const socket = new WebSocket("ws://localhost:5000");

const pencilBtn = document.getElementById("pencilBtn");
const eraserBtn = document.getElementById("eraserBtn");
const thicknessInput = document.getElementById("thickness");
const thicknessValue = document.getElementById("thicknessValue");
const colorPicker = document.getElementById("colorPicker");
const colorControl = document.getElementById("colorControl");
const clearBtn = document.getElementById("clearBtn");
const resetBtn = document.getElementById("resetBtn");
const socketStatus = document.getElementById("socketStatus");
const leaderStatus = document.getElementById("leaderStatus");

let drawing = false;
let previousPoint = null;
let activeTool = "pencil";
let activeColor = colorPicker.value || "#111111";
let activeThickness = Number(thicknessInput.value) || 4;

const BASE_BOARD_WIDTH = 1280;
const BASE_BOARD_HEIGHT = 760;

function clearBoard() {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

function resizeCanvas() {
    const parent = canvas.parentElement;
    const maxWidth = parent.clientWidth;
    const targetWidth = Math.max(860, Math.round(maxWidth));
    const targetHeight = Math.round(targetWidth * (BASE_BOARD_HEIGHT / BASE_BOARD_WIDTH));

    if (canvas.width === targetWidth && canvas.height === targetHeight) {
        return;
    }

    const previous = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCanvas.getContext("2d").putImageData(previous, 0, 0);

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    clearBoard();
    ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
}

ctx.lineCap = "round";
ctx.lineJoin = "round";
clearBoard();
resizeCanvas();

function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

function setActiveTool(tool) {
    activeTool = tool;

    pencilBtn.classList.toggle("active", tool === "pencil");
    eraserBtn.classList.toggle("active", tool === "eraser");
    colorControl.style.opacity = tool === "eraser" ? "0.55" : "1";
}

function updateThickness(value) {
    activeThickness = Number(value);
    thicknessValue.textContent = `${activeThickness} px`;
}

function sendClearCommand() {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ command: "clear" }));
    }
}

function resetTools() {
    setActiveTool("pencil");
    activeColor = "#111111";
    colorPicker.value = activeColor;
    thicknessInput.value = "4";
    updateThickness(4);
}

function updateSocketStatus(text, color) {
    socketStatus.textContent = text;
    socketStatus.style.color = color;
}

function formatLeaderLabel(leaderUrl) {
    if (!leaderUrl) {
        return "Unknown";
    }

    const portMatch = String(leaderUrl).match(/:(\d+)/);
    if (!portMatch) {
        return leaderUrl;
    }

    const port = Number(portMatch[1]);
    const replicaNumber = port - 6000;

    if (replicaNumber >= 1 && replicaNumber <= 9) {
        return `Replica ${replicaNumber} (${port})`;
    }

    return leaderUrl;
}

function updateLeaderStatus(text, color = "#1d2c3b") {
    leaderStatus.textContent = text;
    leaderStatus.style.color = color;
}

async function refreshLeaderStatus() {
    try {
        const response = await fetch("http://localhost:5000/health");
        if (!response.ok) {
            updateLeaderStatus("Unavailable", "#d14f4f");
            return;
        }

        const health = await response.json();
        if (!health.leaderUrl) {
            updateLeaderStatus("Election in progress", "#b07a11");
            return;
        }

        const label = formatLeaderLabel(health.leaderUrl);
        updateLeaderStatus(label, "#0a6957");
    } catch {
        updateLeaderStatus("Unavailable", "#d14f4f");
    }
}

canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    previousPoint = getPoint(event);
    canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointerup", () => {
    drawing = false;
    previousPoint = null;
});

canvas.addEventListener("pointerleave", () => {
    drawing = false;
    previousPoint = null;
});

canvas.addEventListener("pointermove", (event) => {
    if (!drawing || !previousPoint) {
        return;
    }

    const currentPoint = getPoint(event);
    const stroke = {
        x1: previousPoint.x,
        y1: previousPoint.y,
        x2: currentPoint.x,
        y2: currentPoint.y,
        width: activeThickness,
        color: activeColor,
        tool: activeTool
    };

    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(stroke));
    } else {
        drawStroke(stroke);
    }

    previousPoint = currentPoint;
});

socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);

    if (payload.type === "stroke" && payload.stroke && payload.stroke.command === "clear") {
        clearBoard();
        return;
    }

    if (payload.type === "stroke" && payload.stroke) {
        drawStroke(payload.stroke);
        return;
    }

    if (payload.type === "error") {
        console.log(payload.message);
    }
};

socket.onopen = () => updateSocketStatus("Connected", "#0a6957");
socket.onclose = () => updateSocketStatus("Disconnected", "#d14f4f");
socket.onerror = () => updateSocketStatus("Connection Error", "#d14f4f");

function drawStroke(stroke) {
    if (stroke.command === "clear") {
        clearBoard();
        return;
    }

    ctx.beginPath();
    const tool = stroke.tool || "pencil";
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color || "#111";
    ctx.lineWidth = stroke.width || 4;
    ctx.moveTo(stroke.x1, stroke.y1);
    ctx.lineTo(stroke.x2, stroke.y2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
}

pencilBtn.addEventListener("click", () => setActiveTool("pencil"));
eraserBtn.addEventListener("click", () => setActiveTool("eraser"));

thicknessInput.addEventListener("input", (event) => {
    updateThickness(event.target.value);
});

colorPicker.addEventListener("input", (event) => {
    activeColor = event.target.value;
});

clearBtn.addEventListener("click", () => {
    clearBoard();
    sendClearCommand();
});

resetBtn.addEventListener("click", () => {
    resetTools();
});

window.addEventListener("resize", resizeCanvas);

resetTools();
refreshLeaderStatus();
setInterval(refreshLeaderStatus, 2000);