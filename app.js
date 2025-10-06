import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA353ksV2Wnaw904T1LPFUDlTJofS_u3ak",
  authDomain: "rplace-3375e.firebaseapp.com",
  databaseURL: "https://rplace-3375e-default-rtdb.firebaseio.com",
  projectId: "rplace-3375e",
  storageBucket: "rplace-3375e.firebasestorage.app",
  messagingSenderId: "911151728211",
  appId: "1:911151728211:web:4c7f01fa7719ceebb828a6",
  measurementId: "G-94GJHBMCW2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
let uid = null;
let currentColor = "#000000";

let zoomLevel = 1;
const ZOOM_STEP = 0.5;
let offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
let dragEnabled = true;

let isDrawing = false;
let lastX = 0, lastY = 0;

ctx.fillStyle = "#FFFFFF";
ctx.fillRect(0,0,canvas.width,canvas.height);

const paletteBtns = document.querySelectorAll(".color-btn");
paletteBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    currentColor = btn.dataset.color;
    paletteBtns.forEach(b=>b.classList.remove("selected"));
    btn.classList.add("selected");
  });
});

document.getElementById("zoom-in").addEventListener("click", ()=>{
  zoomLevel += ZOOM_STEP;
  applyTransform();
});
document.getElementById("zoom-out").addEventListener("click", ()=>{
  zoomLevel = Math.max(1, zoomLevel - ZOOM_STEP);
  applyTransform();
});

const toggleDragBtn = document.getElementById("toggle-drag");
toggleDragBtn.addEventListener("click", ()=>{
  dragEnabled = !dragEnabled;
  toggleDragBtn.textContent = `Gezinme: ${dragEnabled ? "Açık" : "Kapalı"}`;
});

canvas.addEventListener("wheel", (e)=>{
  e.preventDefault();
  zoomLevel += (e.deltaY < 0 ? 1 : -1) * ZOOM_STEP;
  zoomLevel = Math.max(1, Math.min(10, zoomLevel));
  applyTransform();
});

canvas.addEventListener("mousedown", (e)=>{
  if(dragEnabled){
    isDragging = true;
    dragStartX = e.clientX - offsetX;
    dragStartY = e.clientY - offsetY;
  } else {
    startDrawing(e);
  }
});
canvas.addEventListener("mousemove", (e)=>{
  if(dragEnabled && isDragging){
    offsetX = e.clientX - dragStartX;
    offsetY = e.clientY - dragStartY;
    applyTransform();
  } else if(isDrawing){
    continueDrawing(e);
  }
});
canvas.addEventListener("mouseup", ()=>{
  isDragging = false;
  stopDrawing();
});
canvas.addEventListener("mouseleave", ()=>{
  isDragging = false;
  stopDrawing();
});

canvas.addEventListener("touchstart",(e)=>{
  if(e.touches.length !== 1) return;
  const touch = e.touches[0];
  if(dragEnabled){
    isDragging = true;
    dragStartX = touch.clientX - offsetX;
    dragStartY = touch.clientY - offsetY;
  } else {
    startDrawing(touch);
  }
});
canvas.addEventListener("touchmove",(e)=>{
  if(e.touches.length !== 1) return;
  const touch = e.touches[0];
  if(dragEnabled && isDragging){
    offsetX = touch.clientX - dragStartX;
    offsetY = touch.clientY - dragStartY;
    applyTransform();
  } else if(isDrawing){
    continueDrawing(touch);
    e.preventDefault();
  }
});
canvas.addEventListener("touchend",()=>{ stopDrawing(); isDragging=false; });
canvas.addEventListener("touchcancel",()=>{ stopDrawing(); isDragging=false; });

function applyTransform(){
  canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoomLevel})`;
  canvas.style.transformOrigin = "0 0";
}

signInAnonymously(auth).catch(err=>{
  console.log("Doğrulama hatası:", err.message);
});

onAuthStateChanged(auth, user=>{
  if(!user) return;
  uid = user.uid;
  watchBoard();
});

function watchBoard(){
  const boardRef = ref(db,"board");
  onValue(boardRef, snapshot=>{
    const data = snapshot.val();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    if(data){
      for(let key in data){
        const p = data[key];
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x,p.y,1,1);
      }
    }
  });
}

function startDrawing(e){
  isDrawing = true;
  const {x, y} = getCanvasCoords(e);
  lastX = x; lastY = y;
  drawPixel(x, y);
}

function continueDrawing(e){
  const {x, y} = getCanvasCoords(e);
  drawLine(lastX, lastY, x, y);
  lastX = x; lastY = y;
}

function stopDrawing(){
  isDrawing = false;
}

function getCanvasCoords(e){
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
  const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
  return {x, y};
}

async function drawPixel(x, y){
  if(x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;
  const key = `${x}_${y}`;
  const pixelRef = ref(db, `board/${key}`);
  const data = {x, y, color: currentColor, uid, ts:Date.now()};
  await set(pixelRef, data);
}

async function drawLine(x0, y0, x1, y1){
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0, y = y0;
  while(true){
    await drawPixel(x, y);
    if(x === x1 && y === y1) break;
    let e2 = 2*err;
    if(e2 > -dy){ err -= dy; x += sx; }
    if(e2 < dx){ err += dx; y += sy; }
  }
}
