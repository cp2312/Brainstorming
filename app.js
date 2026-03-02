// =============================================
// LLUVIA DE IDEAS — app.js
// Firebase Firestore + Nubes animadas + Análisis con Claude API
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---- FIREBASE CONFIG ----
const firebaseConfig = {
  apiKey: "AIzaSyAIuQfx7L8gEEeDt7RDxOfkKN1mNndiVuU",
  authDomain: "brainstorming-universidad.firebaseapp.com",
  projectId: "brainstorming-universidad",
  storageBucket: "brainstorming-universidad.firebasestorage.app",
  messagingSenderId: "707126023361",
  appId: "1:707126023361:web:495e6271801f0e5e29b040"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---- ESTADO ----
let ideasGlobales = [];
const posicionesOcupadas = []; // Para evitar que las nubes se encimen
const CLOUD_COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

// ---- ELEMENTOS DOM ----
const sky = document.getElementById("sky");
const totalEl = document.getElementById("total");
const resultadoWrap = document.getElementById("resultado-wrap");
const resultadoTexto = document.getElementById("resultado-texto");
const btnAnalisis = document.getElementById("btn-analisis");
const btnEnviar = document.getElementById("btn-enviar");
const inputIdea = document.getElementById("idea");

// ---- ENVIAR IDEA ----
window.enviarIdea = async function () {
  const texto = inputIdea.value.trim();
  if (!texto) return;

  btnEnviar.disabled = true;
  try {
    await addDoc(collection(db, "ideas"), {
      texto,
      timestamp: Date.now()
    });
    inputIdea.value = "";
  } catch (e) {
    console.error("Error al guardar idea:", e);
  } finally {
    btnEnviar.disabled = false;
    inputIdea.focus();
  }
};

// Enter para enviar
inputIdea.addEventListener("keydown", (e) => {
  if (e.key === "Enter") window.enviarIdea();
});

// ---- ESCUCHAR IDEAS EN TIEMPO REAL ----
const idsYaMostrados = new Set();

onSnapshot(collection(db, "ideas"), (snapshot) => {
  ideasGlobales = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    ideasGlobales.push(data.texto);

    // Solo crear nube para ideas nuevas
    if (!idsYaMostrados.has(doc.id)) {
      idsYaMostrados.add(doc.id);
      crearNube(data.texto, true);
    }
  });

  totalEl.textContent = ideasGlobales.length;
});

// ---- CREAR NUBE EN EL CIELO ----
function crearNube(texto, esNueva = false) {
  const nube = document.createElement("div");
  const colorClass = CLOUD_COLORS[Math.floor(Math.random() * CLOUD_COLORS.length)];
  nube.className = `nube ${esNueva ? 'nueva' : ''} ${colorClass}`;

  // Estructura interna: bultos decorativos + texto encima
  nube.innerHTML = `
    <div class="bump-left"></div>
    <div class="bump-right"></div>
    <div class="nube-body">
      <span class="nube-texto">${escapeHTML(texto)}</span>
    </div>
  `;

  // Posición aleatoria sin solapamiento
  const pos = encontrarPosicion();
  nube.style.left = pos.x + "%";
  nube.style.top = pos.y + "%";

  // Animación flotante con duración aleatoria
  const duracion = 6 + Math.random() * 6;
  const delay = Math.random() * -8;
  nube.style.animationDuration = duracion + "s";
  nube.style.animationDelay = delay + "s";

  sky.appendChild(nube);

  // Limpiar nubes si hay demasiadas (máx 40 visibles)
  const nubes = sky.querySelectorAll(".nube");
  if (nubes.length > 40) {
    nubes[0].remove();
    posicionesOcupadas.shift();
  }
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function encontrarPosicion() {
  let intentos = 0;
  let x, y;

  do {
    x = 3 + Math.random() * 80;  // full width
    y = 3 + Math.random() * 88;  // full height
    intentos++;
  } while (hayColision(x, y) && intentos < 25);

  posicionesOcupadas.push({ x, y });
  return { x, y };
}

function hayColision(x, y) {
  return posicionesOcupadas.some(p => {
    const dx = Math.abs(p.x - x);
    const dy = Math.abs(p.y - y);
    return dx < 18 && dy < 14; // mínima separación en %
  });
}

// ---- ANÁLISIS CON CLAUDE API ----
async function _ejecutarAnalisis() {
  if (ideasGlobales.length === 0) {
    alert("¡Aún no hay ideas! Pide al grupo que participe primero.");
    return;
  }

  btnAnalisis.disabled = true;
  btnAnalisis.innerHTML = '<span class="spinner"></span> Analizando...';

  resultadoWrap.classList.add("visible");
  resultadoTexto.innerHTML = '<span class="spinner"></span> Claude está leyendo todas las ideas...';

  try {
    const ideasTexto = ideasGlobales
      .map((idea, i) => `${i + 1}. "${idea}"`)
      .join("\n");

    const prompt = `Eres un facilitador experto en dinámicas grupales y técnicas de creatividad.

El grupo respondió a la pregunta: "¿Qué crees que es el brainstorming?"

Estas son las ${ideasGlobales.length} respuestas del grupo:
${ideasTexto}

Por favor, analiza estas respuestas y entrega:
1. **Conclusión colectiva**: Una síntesis de 2-3 oraciones que capture la visión del grupo sobre el brainstorming.
2. **Temas clave identificados**: Los 3-5 conceptos o palabras más recurrentes, explicando brevemente cada uno.
3. **Perspectiva destacada**: Una idea original o interesante que se haya mencionado.
4. **Reflexión final**: Una observación breve sobre la diversidad o consenso del grupo.

Responde de forma amigable, motivadora y en español.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const textoRespuesta = data.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n");

    // Mostrar con efecto de escritura
    await mostrarConEfectoEscritura(textoRespuesta);

  } catch (error) {
    console.error("Error al llamar a la API:", error);

    // Fallback: análisis local si la API no está disponible
    const analisisLocal = generarAnalisisLocal(ideasGlobales);
    await mostrarConEfectoEscritura(analisisLocal);
  } finally {
    btnAnalisis.disabled = false;
    btnAnalisis.innerHTML = "✨ Analizar todas las ideas";
  }
};

// ---- EFECTO DE ESCRITURA (TYPEWRITER) ----
async function mostrarConEfectoEscritura(texto) {
  resultadoTexto.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';

  // Formatear markdown básico
  const textoFormateado = formatearMarkdown(texto);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = textoFormateado;

  resultadoTexto.appendChild(tempDiv);
  resultadoTexto.appendChild(cursor);

  // Animar la aparición gradual
  tempDiv.style.opacity = '0';
  tempDiv.style.transition = 'opacity 0.8s ease';

  await new Promise(r => setTimeout(r, 100));
  tempDiv.style.opacity = '1';

  await new Promise(r => setTimeout(r, 900));
  cursor.remove();
}

// ---- FORMATEADOR MARKDOWN BÁSICO ----
function formatearMarkdown(texto) {
  return texto
    // **bold**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // *italic*
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Títulos ## y #
    .replace(/^### (.+)$/gm, '<h4 style="color:#6c63ff;margin:12px 0 6px;font-family:Syne,sans-serif">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:#6c63ff;margin:14px 0 8px;font-family:Syne,sans-serif">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="color:#6c63ff;margin:16px 0 8px;font-family:Syne,sans-serif">$1</h2>')
    // Saltos de línea
    .replace(/\n\n/g, '</p><p style="margin-top:10px">')
    .replace(/\n/g, '<br>');
}

// ---- ANÁLISIS LOCAL (FALLBACK) ----
function generarAnalisisLocal(ideas) {
  const palabrasIgnoradas = new Set([
    "el","la","los","las","es","un","una","de","y","para",
    "que","en","con","como","se","del","al","por","son",
    "más","muy","lo","no","si","su","hay","pero","también",
    "esto","esta","tiene","pueden","cada","idea","ideas"
  ]);

  const contador = {};

  ideas.forEach(texto => {
    texto
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .forEach(palabra => {
        if (!palabrasIgnoradas.has(palabra) && palabra.length > 3) {
          contador[palabra] = (contador[palabra] || 0) + 1;
        }
      });
  });

  const top5 = Object.entries(contador)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);

  if (top5.length === 0) {
    return "Aún no hay suficientes ideas para generar un análisis. ¡Pide al grupo que participe más!";
  }

  const temas = top5.map(p => `**${p}**`).join(", ");

  return `**Conclusión colectiva:** El grupo entiende el brainstorming como una técnica creativa y colaborativa que facilita la generación libre de ideas.

**Temas clave identificados:** Los conceptos que más resonaron fueron: ${temas}. Estos términos reflejan una comprensión compartida de la dinámica grupal.

**Perspectiva destacada:** Entre las ${ideas.length} respuestas recibidas, se evidencia una visión positiva y abierta sobre el potencial de las ideas colectivas.

**Reflexión final:** El grupo muestra un buen nivel de comprensión conceptual. ¡Es un excelente punto de partida para profundizar en la técnica! 🎉`;
}

// ---- REINICIAR LLUVIA DE IDEAS ----
async function _ejecutarReinicio() {
  const btnReiniciar = document.getElementById("btn-reiniciar");
  btnReiniciar.disabled = true;
  btnReiniciar.textContent = "⏳ Borrando...";

  try {
    // Borrar todos los documentos de Firebase
    const snapshot = await getDocs(collection(db, "ideas"));
    const deletes = snapshot.docs.map(d => deleteDoc(doc(db, "ideas", d.id)));
    await Promise.all(deletes);

    // Limpiar nubes del cielo
    sky.innerHTML = "";
    posicionesOcupadas.length = 0;
    idsYaMostrados.clear();

    // Ocultar resultado si estaba visible
    document.getElementById("resultado-wrap").classList.remove("visible");
    document.getElementById("resultado-texto").innerHTML = "";

  } catch (e) {
    console.error("Error al reiniciar:", e);
    alert("Hubo un error al reiniciar. Intenta de nuevo.");
  } finally {
    btnReiniciar.disabled = false;
    btnReiniciar.innerHTML = "🗑️ Reiniciar lluvia de ideas";
  }
};

// ---- SISTEMA DE CONTRASEÑA ----
const CLAVE_SECRETA = "4321";
let accionPendiente = null; // 'analisis' o 'reinicio'

// Interceptar botones con clave
window.generarAnalisis = function () {
  pedirClave('analisis');
};

window.reiniciarIdeas = function () {
  pedirClave('reinicio');
};

function pedirClave(accion) {
  accionPendiente = accion;
  const overlay = document.getElementById("modal-overlay");
  const icon    = document.getElementById("modal-icon");
  const title   = document.getElementById("modal-title");
  const sub     = document.getElementById("modal-subtitle");
  const input   = document.getElementById("modal-input");
  const error   = document.getElementById("modal-error");

  if (accion === 'analisis') {
    icon.textContent  = "✨";
    title.textContent = "Analizar ideas";
    sub.textContent   = "Ingresa la clave para generar el análisis";
  } else {
    icon.textContent  = "🗑️";
    title.textContent = "Reiniciar lluvia";
    sub.textContent   = "Ingresa la clave para borrar todas las ideas";
  }

  input.value = "";
  error.classList.remove("visible");
  overlay.classList.add("visible");
  setTimeout(() => input.focus(), 100);
}

window.cerrarModal = function () {
  document.getElementById("modal-overlay").classList.remove("visible");
  document.getElementById("modal-error").classList.remove("visible");
  accionPendiente = null;
};

window.confirmarModal = function () {
  const input = document.getElementById("modal-input");
  const error = document.getElementById("modal-error");

  if (input.value !== CLAVE_SECRETA) {
    error.classList.add("visible");
    input.value = "";
    input.focus();
    // Quitar error tras 2s
    setTimeout(() => error.classList.remove("visible"), 2000);
    return;
  }

  cerrarModal();

  if (accionPendiente === 'analisis') {
    _ejecutarAnalisis();
  } else if (accionPendiente === 'reinicio') {
    _ejecutarReinicio();
  }
};

// Enter en el input del modal
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("modal-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") window.confirmarModal();
      if (e.key === "Escape") window.cerrarModal();
    });
  }
});

// Clic fuera del modal para cerrar
document.getElementById("modal-overlay")?.addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") window.cerrarModal();
});