// =============================================
// LLUVIA DE IDEAS — app.js  (versión limpia)
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, getDocs, deleteDoc, doc }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---- FIREBASE ----
const firebaseConfig = {
  apiKey: "AIzaSyAIuQfx7L8gEEeDt7RDxOfkKN1mNndiVuU",
  authDomain: "brainstorming-universidad.firebaseapp.com",
  projectId: "brainstorming-universidad",
  storageBucket: "brainstorming-universidad.firebasestorage.app",
  messagingSenderId: "707126023361",
  appId: "1:707126023361:web:495e6271801f0e5e29b040"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ---- ESTADO ----
let ideasGlobales      = [];
const posicionesOcupadas = [];
const idsYaMostrados   = new Set();
const CLOUD_COLORS     = ['c1','c2','c3','c4','c5','c6'];
const CLAVE_SECRETA    = "4321";
let   accionPendiente  = null;

// ---- DOM ----
const sky           = document.getElementById("sky");
const totalEl       = document.getElementById("total");
const inputEl       = document.getElementById("idea");
const btnEnviar     = document.getElementById("btn-enviar");
const resultadoWrap = document.getElementById("resultado-wrap");
const resultadoTexto= document.getElementById("resultado-texto");
const modalOverlay  = document.getElementById("modal-overlay");
const modalInput    = document.getElementById("modal-input");
const modalError    = document.getElementById("modal-error");
const modalIcon     = document.getElementById("modal-icon");
const modalTitle    = document.getElementById("modal-title");
const modalSubtitle = document.getElementById("modal-subtitle");

// ---- ENVIAR IDEA ----
window.enviarIdea = async function () {
  const texto = inputEl.value.trim();
  if (!texto) return;
  btnEnviar.disabled = true;
  try {
    await addDoc(collection(db, "ideas"), { texto, ts: Date.now() });
    inputEl.value = "";
  } catch (e) {
    console.error("Error al guardar:", e);
  } finally {
    btnEnviar.disabled = false;
    inputEl.focus();
  }
};
inputEl.addEventListener("keydown", e => { if (e.key === "Enter") window.enviarIdea(); });

// ---- ESCUCHAR IDEAS EN TIEMPO REAL ----
onSnapshot(collection(db, "ideas"), snapshot => {
  ideasGlobales = [];
  snapshot.forEach(d => {
    ideasGlobales.push(d.data().texto);
    if (!idsYaMostrados.has(d.id)) {
      idsYaMostrados.add(d.id);
      crearNube(d.data().texto, true);
    }
  });
  totalEl.textContent = ideasGlobales.length;
});

// ---- NUBES ----
function crearNube(texto, esNueva = false) {
  const nube = document.createElement("div");
  const color = CLOUD_COLORS[Math.floor(Math.random() * CLOUD_COLORS.length)];
  nube.className = `nube ${esNueva ? "nueva" : ""} ${color}`;
  nube.innerHTML = `
    <div class="bump-left"></div>
    <div class="bump-right"></div>
    <div class="nube-body">
      <span class="nube-texto">${escapeHTML(texto)}</span>
    </div>`;

  const pos = encontrarPosicion();
  nube.style.left = pos.x + "%";
  nube.style.top  = pos.y + "%";
  const dur = 6 + Math.random() * 6;
  nube.style.animationDuration = dur + "s";
  nube.style.animationDelay   = (Math.random() * -8) + "s";
  sky.appendChild(nube);

  const nubes = sky.querySelectorAll(".nube");
  if (nubes.length > 50) { nubes[0].remove(); posicionesOcupadas.shift(); }
}

function encontrarPosicion() {
  let intentos = 0, x, y;
  do {
    x = 3 + Math.random() * 82;
    y = 3 + Math.random() * 85;
    intentos++;
  } while (hayColision(x, y) && intentos < 30);
  posicionesOcupadas.push({ x, y });
  return { x, y };
}

function hayColision(x, y) {
  return posicionesOcupadas.some(p => Math.abs(p.x - x) < 16 && Math.abs(p.y - y) < 12);
}

function escapeHTML(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ---- SISTEMA DE CLAVE ----
window.solicitarAccion = function(accion) {
  accionPendiente = accion;
  if (accion === 'analisis') {
    modalIcon.textContent    = "✨";
    modalTitle.textContent   = "Analizar ideas";
    modalSubtitle.textContent= "Ingresa la clave para generar el análisis";
  } else {
    modalIcon.textContent    = "🗑️";
    modalTitle.textContent   = "Reiniciar lluvia";
    modalSubtitle.textContent= "Ingresa la clave para borrar todas las ideas";
  }
  modalInput.value = "";
  modalError.classList.remove("visible");
  modalOverlay.classList.add("visible");
  setTimeout(() => modalInput.focus(), 120);
};

window.cerrarModal = function() {
  modalOverlay.classList.remove("visible");
  modalError.classList.remove("visible");
  accionPendiente = null;
};

window.confirmarModal = function() {
  if (modalInput.value !== CLAVE_SECRETA) {
    modalError.classList.add("visible");
    modalInput.value = "";
    modalInput.focus();
    setTimeout(() => modalError.classList.remove("visible"), 2200);
    return;
  }
  cerrarModal();
  if (accionPendiente === 'analisis') ejecutarAnalisis();
  else if (accionPendiente === 'reinicio') ejecutarReinicio();
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
  if (ideasGlobales.length === 0) {
    alert("¡Aún no hay ideas! Pide al grupo que participe primero.");
    return;
  }

  const btnAnalisis = document.querySelector(".btn-analisis");
  btnAnalisis.disabled = true;
  btnAnalisis.innerHTML = '<span class="spinner"></span> Analizando...';

  resultadoWrap.classList.add("visible");
  resultadoTexto.innerHTML = '<span class="spinner"></span> Analizando las ideas del grupo...';

  try {
    const ideasTexto = ideasGlobales.map((idea, i) => `${i+1}. "${idea}"`).join("\n");
    const prompt = `Eres un facilitador experto en dinámicas grupales y técnicas de creatividad.

El grupo respondió a la pregunta: "¿Qué crees que es el brainstorming?"

Estas son las ${ideasGlobales.length} respuestas del grupo:
${ideasTexto}

Por favor, analiza estas respuestas y entrega:
1. **Conclusión colectiva**: Una síntesis de 2-3 oraciones que capture la visión del grupo.
2. **Temas clave identificados**: Los 3-5 conceptos más recurrentes con breve explicación.
3. **Perspectiva destacada**: Una idea original o interesante que se haya mencionado.
4. **Reflexión final**: Una observación breve sobre la diversidad o consenso del grupo.

Responde de forma amigable, motivadora y en español.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    const texto = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    mostrarConEfecto(texto);

  } catch (error) {
    console.error("Error API:", error);
    mostrarConEfecto(analisisLocal(ideasGlobales));
  } finally {
    btnAnalisis.disabled = false;
    btnAnalisis.innerHTML = "✨ Analizar";
  }
}

// ---- REINICIO ----
async function ejecutarReinicio() {
  const btnReiniciar = document.querySelector(".btn-reiniciar");
  btnReiniciar.disabled = true;
  btnReiniciar.textContent = "⏳ Borrando...";

  try {
    const snapshot = await getDocs(collection(db, "ideas"));
    await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, "ideas", d.id))));
    sky.innerHTML = "";
    posicionesOcupadas.length = 0;
    idsYaMostrados.clear();
    ideasGlobales = [];
    totalEl.textContent = "0";
    resultadoWrap.classList.remove("visible");
    resultadoTexto.innerHTML = "";
  } catch (e) {
    console.error("Error al reiniciar:", e);
    alert("Error al reiniciar. Intenta de nuevo.");
  } finally {
    btnReiniciar.disabled = false;
    btnReiniciar.innerHTML = "🗑️ Reiniciar";
  }
}

// ---- CERRAR RESULTADO ----
window.cerrarResultado = function() {
  resultadoWrap.classList.remove("visible");
};

// ---- EFECTO ESCRITURA ----
function mostrarConEfecto(texto) {
  const html = formatearMd(texto);
  const div = document.createElement("div");
  div.innerHTML = html;
  div.style.opacity = "0";
  div.style.transition = "opacity 0.7s ease";
  resultadoTexto.innerHTML = "";
  resultadoTexto.appendChild(div);
  requestAnimationFrame(() => requestAnimationFrame(() => { div.style.opacity = "1"; }));
}

function formatearMd(texto) {
  return texto
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, '<h4 style="color:#7c3aed;margin:10px 0 5px;font-family:Syne,sans-serif">$1</h4>')
    .replace(/^## (.+)$/gm,  '<h3 style="color:#7c3aed;margin:12px 0 6px;font-family:Syne,sans-serif">$1</h3>')
    .replace(/^# (.+)$/gm,   '<h2 style="color:#7c3aed;margin:14px 0 7px;font-family:Syne,sans-serif">$1</h2>')
    .replace(/\n\n/g, '</p><p style="margin-top:8px">')
    .replace(/\n/g, "<br>");
}

// ---- ANÁLISIS LOCAL (fallback) ----
function analisisLocal(ideas) {
  const ignoradas = new Set(["el","la","los","las","es","un","una","de","y","para","que","en","con","como","se","del","al","por","son","más","muy","lo","no","si","su","hay","pero","también","esto","esta","tiene","pueden","cada","idea","ideas"]);
  const cnt = {};
  ideas.forEach(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w\s]/g,"").split(/\s+/).forEach(p => {
    if (!ignoradas.has(p) && p.length > 3) cnt[p] = (cnt[p]||0) + 1;
  }));
  const top = Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([p])=>`**${p}**`).join(", ");
  if (!top) return "Aún no hay suficientes ideas para generar un análisis.";
  return `**Conclusión colectiva:** El grupo entiende el brainstorming como una técnica creativa y colaborativa que facilita la generación libre de ideas.\n\n**Temas clave:** ${top}\n\n**Reflexión final:** ¡El grupo muestra un excelente punto de partida para profundizar en la técnica! 🎉`;
}