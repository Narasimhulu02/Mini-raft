const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const socket = new WebSocket("ws://localhost:5000");

let drawing = false;
let previousPoint = null;

ctx.lineWidth = 3;
ctx.lineCap = "round";
ctx.strokeStyle = "#111";

function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    previousPoint = getPoint(event);
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
        width: 3,
        color: "#111"
    };

    socket.send(JSON.stringify(stroke));
    previousPoint = currentPoint;
});

socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);

    if (payload.type === "stroke" && payload.stroke) {
        drawStroke(payload.stroke);
        return;
    }

    if (payload.type === "error") {
        console.log(payload.message);
    }
};

function drawStroke(stroke) {
    ctx.beginPath();
    ctx.strokeStyle = stroke.color || "#111";
    ctx.lineWidth = stroke.width || 3;
    ctx.moveTo(stroke.x1, stroke.y1);
    ctx.lineTo(stroke.x2, stroke.y2);
    ctx.stroke();
}