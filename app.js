import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, getDocs, deleteDoc, doc }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAIuQfx7L8gEEeDt7RDxOfkKN1mNndiVuU",
  authDomain: "brainstorming-universidad.firebaseapp.com",
  projectId: "brainstorming-universidad",
  storageBucket: "brainstorming-universidad.firebasestorage.app",
  messagingSenderId: "707126023361",
  appId: "1:707126023361:web:495e6271801f0e5e29b040"
};
const db = getFirestore(initializeApp(firebaseConfig));

// Estado
let ideasGlobales = [];
const posiciones = [];
const vistos = new Set();
const COLORES = ['c1','c2','c3','c4','c5','c6'];
const CLAVE = "4321";
let accionPendiente = null;

// DOM
const sky          = document.getElementById("sky");
const entrada      = document.getElementById("entrada");
const cieloUI      = document.getElementById("cielo-ui");
const totalEl      = document.getElementById("total");
const inputEl      = document.getElementById("idea");
const resultadoWrap= document.getElementById("resultado-wrap");
const resultadoTxt = document.getElementById("resultado-texto");
const modalOverlay = document.getElementById("modal-overlay");
const modalInput   = document.getElementById("modal-input");
const modalError   = document.getElementById("modal-error");

// ---- ENVIAR IDEA: oculta la entrada y muestra el cielo ----
window.enviarIdea = async function() {
  const texto = inputEl.value.trim();
  if (!texto) return;

  document.getElementById("btn-enviar").disabled = true;

  try {
    await addDoc(collection(db, "ideas"), { texto, ts: Date.now() });
    // Ocultar pantalla de entrada y mostrar cielo
    entrada.classList.add("oculta");
    cieloUI.classList.add("visible");
  } catch(e) {
    console.error(e);
    document.getElementById("btn-enviar").disabled = false;
  }
};

inputEl.addEventListener("keydown", e => { if (e.key === "Enter") window.enviarIdea(); });

// ---- ESCUCHAR IDEAS EN TIEMPO REAL ----
onSnapshot(collection(db, "ideas"), snapshot => {
  ideasGlobales = [];
  snapshot.forEach(d => {
    ideasGlobales.push(d.data().texto);
    if (!vistos.has(d.id)) {
      vistos.add(d.id);
      crearNube(d.data().texto);
    }
  });
  totalEl.textContent = ideasGlobales.length;
});

// ---- NUBES ----
function crearNube(texto) {
  const n = document.createElement("div");
  const c = COLORES[Math.floor(Math.random() * COLORES.length)];
  n.className = `nube nueva ${c}`;
  n.innerHTML = `
    <div class="bl"></div>
    <div class="br"></div>
    <div class="nube-body"><span class="nube-texto">${esc(texto)}</span></div>`;

  const pos = randomPos();
  n.style.left = pos.x + "%";
  n.style.top  = pos.y + "%";
  n.style.animationDuration = (6 + Math.random()*6) + "s";
  n.style.animationDelay    = (Math.random()*-8) + "s";
  sky.appendChild(n);

  // Máx 60 nubes
  const nubes = sky.querySelectorAll(".nube");
  if (nubes.length > 60) { nubes[0].remove(); posiciones.shift(); }
}

function randomPos() {
  let x, y, tries = 0;
  do {
    x = 3 + Math.random() * 82;
    y = 3 + Math.random() * 85;
    tries++;
  } while (posiciones.some(p => Math.abs(p.x-x)<15 && Math.abs(p.y-y)<12) && tries < 30);
  posiciones.push({x, y});
  return {x, y};
}

function esc(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ---- MODAL DE CLAVE ----
window.solicitarAccion = function(accion) {
  accionPendiente = accion;
  document.getElementById("modal-icon").textContent    = accion === 'analisis' ? "✨" : "🗑️";
  document.getElementById("modal-title").textContent   = accion === 'analisis' ? "Analizar ideas" : "Reiniciar lluvia";
  document.getElementById("modal-subtitle").textContent= accion === 'analisis'
    ? "Ingresa la clave para generar el análisis"
    : "Ingresa la clave para borrar todas las ideas";
  modalInput.value = "";
  modalError.classList.remove("visible");
  modalOverlay.classList.add("visible");
  setTimeout(() => modalInput.focus(), 120);
};

window.cerrarModal = function() {
  modalOverlay.classList.remove("visible");
  accionPendiente = null;
};

window.confirmarModal = function() {
  if (modalInput.value !== CLAVE) {
    modalError.classList.add("visible");
    modalInput.value = "";
    modalInput.focus();
    setTimeout(() => modalError.classList.remove("visible"), 2000);
    return;
  }
  cerrarModal();
  if (accionPendiente === 'analisis') ejecutarAnalisis();
  else ejecutarReinicio();
};

modalInput.addEventListener("keydown", e => {
  if (e.key === "Enter") window.confirmarModal();
  if (e.key === "Escape") window.cerrarModal();
});
modalOverlay.addEventListener("click", e => {
  if (e.target === modalOverlay) window.cerrarModal();
});

// ---- ANÁLISIS ----
async function ejecutarAnalisis() {
  if (!ideasGlobales.length) { alert("¡Aún no hay ideas!"); return; }

  const btn = document.querySelector(".btn-analizar");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analizando...';
  resultadoWrap.classList.add("visible");
  resultadoTxt.innerHTML = '<span class="spinner"></span> Analizando las ideas...';

  try {
    const lista = ideasGlobales.map((v,i) => `${i+1}. "${v}"`).join("\n");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content:
          `Eres un facilitador experto en dinámicas grupales. El grupo respondió: "¿Qué crees que es el brainstorming?"\n\nRespuestas (${ideasGlobales.length}):\n${lista}\n\nAnaliza y entrega:\n1. **Conclusión colectiva** (2-3 oraciones)\n2. **Temas clave** (3-5 conceptos recurrentes)\n3. **Idea destacada** (la más original)\n4. **Reflexión final** (diversidad o consenso)\n\nResponde en español, de forma amigable y motivadora.`
        }]
      })
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const texto = data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n");
    mostrar(texto);
  } catch(e) {
    mostrar(fallback(ideasGlobales));
  } finally {
    btn.disabled = false;
    btn.innerHTML = "✨ Analizar";
  }
}

// ---- REINICIO ----
async function ejecutarReinicio() {
  const btn = document.querySelector(".btn-reiniciar");
  btn.disabled = true;
  btn.textContent = "⏳ Borrando...";
  try {
    const snap = await getDocs(collection(db, "ideas"));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "ideas", d.id))));
    // Limpiar estado
    sky.innerHTML = "";
    posiciones.length = 0;
    vistos.clear();
    ideasGlobales = [];
    totalEl.textContent = "0";
    resultadoWrap.classList.remove("visible");
    // Volver a la pantalla de entrada
    entrada.classList.remove("oculta");
    cieloUI.classList.remove("visible");
    inputEl.value = "";
    document.getElementById("btn-enviar").disabled = false;
  } catch(e) {
    alert("Error al reiniciar.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "🗑️ Reiniciar";
  }
}

// ---- MOSTRAR RESULTADO ----
function mostrar(texto) {
  const html = texto
    .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.*?)\*/g,"<em>$1</em>")
    .replace(/\n\n/g,"</p><p style='margin-top:8px'>")
    .replace(/\n/g,"<br>");
  const div = document.createElement("div");
  div.innerHTML = html;
  div.style.cssText = "opacity:0;transition:opacity 0.6s ease";
  resultadoTxt.innerHTML = "";
  resultadoTxt.appendChild(div);
  requestAnimationFrame(() => requestAnimationFrame(() => div.style.opacity = "1"));
}

// ---- FALLBACK LOCAL ----
function fallback(ideas) {
  const stop = new Set(["el","la","los","las","es","un","una","de","y","para","que","en","con","como","se","del","al","por","son","más","muy","lo","no","si","su","hay","pero","también","esto","esta","idea","ideas"]);
  const cnt = {};
  ideas.forEach(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w\s]/g,"").split(/\s+/).forEach(p => {
    if (!stop.has(p) && p.length > 3) cnt[p] = (cnt[p]||0)+1;
  }));
  const top = Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([p])=>`**${p}**`).join(", ");
  if (!top) return "Aún no hay suficientes ideas para analizar.";
  return `**Conclusión colectiva:** El grupo entiende el brainstorming como una técnica creativa y colaborativa para generar ideas libremente.\n\n**Temas clave:** ${top}\n\n**Reflexión final:** ¡El grupo muestra un excelente nivel de comprensión! 🎉`;
}