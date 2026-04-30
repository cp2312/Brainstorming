import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* =========================
   FIREBASE CONFIG
========================= */
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

/* =========================
   CONFIG GENERAL
========================= */
const CLAVE_ADMIN = "4321";
const COLORES = ["c1", "c2", "c3", "c4", "c5", "c6"];
const MAX_NUBES = 60;

let ideasGlobales = [];
let accionPendiente = null;
const vistos = new Set();
const posiciones = [];

/* =========================
   DOM
========================= */
const sky = document.getElementById("sky");
const entrada = document.getElementById("entrada");
const cieloUI = document.getElementById("cielo-ui");
const totalEl = document.getElementById("total");
const inputIdea = document.getElementById("idea");
const resultadoWrap = document.getElementById("resultado-wrap");
const resultadoTexto = document.getElementById("resultado-texto");

const modalOverlay = document.getElementById("modal-overlay");
const modalInput = document.getElementById("modal-input");
const modalError = document.getElementById("modal-error");

const btnEnviar = document.getElementById("btn-enviar");

/* =========================
   UTILIDADES
========================= */
function escapeHTML(texto) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mostrarResultado(texto) {
  resultadoWrap.classList.add("visible");

  const html = texto
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  resultadoTexto.innerHTML = `<p>${html}</p>`;
}

function randomPos() {
  let x, y, intentos = 0;

  do {
    x = 5 + Math.random() * 80;
    y = 5 + Math.random() * 80;
    intentos++;
  } while (
    posiciones.some(
      (p) => Math.abs(p.x - x) < 15 && Math.abs(p.y - y) < 12
    ) &&
    intentos < 30
  );

  posiciones.push({ x, y });
  return { x, y };
}

/* =========================
   NUBES
========================= */
function crearNube(texto) {
  const nube = document.createElement("div");
  const color = COLORES[Math.floor(Math.random() * COLORES.length)];

  nube.className = `nube nueva ${color}`;
  nube.innerHTML = `
    <div class="bl"></div>
    <div class="br"></div>
    <div class="nube-body">
      <span class="nube-texto">${escapeHTML(texto)}</span>
    </div>
  `;

  const pos = randomPos();
  nube.style.left = `${pos.x}%`;
  nube.style.top = `${pos.y}%`;
  nube.style.animationDuration = `${6 + Math.random() * 6}s`;

  sky.appendChild(nube);

  const nubes = sky.querySelectorAll(".nube");
  if (nubes.length > MAX_NUBES) {
    nubes[0].remove();
    posiciones.shift();
  }
}

/* =========================
   FIREBASE - GUARDAR IDEA
========================= */
window.enviarIdea = async function () {
  const texto = inputIdea.value.trim();
  if (!texto) return;

  btnEnviar.disabled = true;

  try {
    await addDoc(collection(db, "ideas"), {
      texto,
      createdAt: Date.now()
    });

    inputIdea.value = "";
    entrada.classList.add("oculta");
    cieloUI.classList.add("visible");
  } catch (error) {
    console.error("Error guardando idea:", error);
    alert("No se pudo guardar la idea.");
  } finally {
    btnEnviar.disabled = false;
  }
};

inputIdea.addEventListener("keydown", (e) => {
  if (e.key === "Enter") window.enviarIdea();
});

/* =========================
   FIREBASE - TIEMPO REAL
========================= */
onSnapshot(collection(db, "ideas"), (snapshot) => {
  ideasGlobales = [];

  snapshot.forEach((item) => {
    const data = item.data();
    ideasGlobales.push(data.texto);

    if (!vistos.has(item.id)) {
      vistos.add(item.id);
      crearNube(data.texto);
    }
  });

  totalEl.textContent = ideasGlobales.length;
});

/* =========================
   MODAL ADMIN
========================= */
window.solicitarAccion = function (accion) {
  accionPendiente = accion;
  modalInput.value = "";
  modalError.classList.remove("visible");
  modalOverlay.classList.add("visible");

  setTimeout(() => modalInput.focus(), 150);
};

window.cerrarModal = function () {
  modalOverlay.classList.remove("visible");
  accionPendiente = null;
};

window.confirmarModal = function () {
  if (modalInput.value !== CLAVE_ADMIN) {
    modalError.classList.add("visible");
    modalInput.value = "";
    modalInput.focus();

    setTimeout(() => {
      modalError.classList.remove("visible");
    }, 2000);

    return;
  }

  // guardar la acción antes de cerrar
  const accion = accionPendiente;

  cerrarModal();

  if (accion === "analisis") {
    ejecutarAnalisis();
  }

  if (accion === "reinicio") {
    ejecutarReinicio();
  }
};

/* =========================
   ANALISIS IA
========================= */
async function ejecutarAnalisis() {
  if (!ideasGlobales.length) {
    alert("Aún no hay ideas registradas.");
    return;
  }

  const lista = ideasGlobales
    .map((idea, i) => `${i + 1}. ${idea}`)
    .join("\n");

  mostrarResultado("Analizando ideas del grupo...");

  try {
    const prompt = `
Eres un experto universitario en brainstorming y trabajo colaborativo.

El grupo respondió a la pregunta:
¿Qué crees que es el brainstorming?

Respuestas:
${lista}

Debes responder con:

1. Definición correcta de brainstorming
2. Concepto construido por el grupo
3. Comparación entre ambos
4. Temas clave más repetidos
5. Conclusión final académica

Responde en español, tono profesional y claro.
`;

    // Aquí luego conectas tu API real
    // mientras tanto usamos fallback local
    throw new Error("Modo local");
  } catch (error) {
    mostrarResultado(generarFallback(ideasGlobales));
  }
}

function generarFallback(ideas) {
  const stopWords = new Set([
    "el", "la", "los", "las", "es", "un", "una", "de",
    "y", "para", "que", "en", "con", "como", "por"
  ]);

  const contador = {};

  ideas.forEach((texto) => {
    texto
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .forEach((palabra) => {
        if (!stopWords.has(palabra) && palabra.length > 3) {
          contador[palabra] = (contador[palabra] || 0) + 1;
        }
      });
  });

  const top = Object.entries(contador)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => `**${p}**`)
    .join(", ");

  return `
**Definición correcta:**
El brainstorming es una técnica grupal orientada a generar ideas libremente sin críticas iniciales.

**Concepto del grupo:**
Los participantes lo relacionan con creatividad, colaboración y construcción de soluciones.

**Temas clave:**
${top || "creatividad, grupo y participación"}

**Conclusión final:**
El grupo comprende adecuadamente que el brainstorming permite construir conocimiento colectivo mediante la participación activa.
`;
}

/* =========================
   REINICIAR
========================= */
async function ejecutarReinicio() {
  try {
    const snapshot = await getDocs(collection(db, "ideas"));

    await Promise.all(
      snapshot.docs.map((d) => deleteDoc(doc(db, "ideas", d.id)))
    );

    sky.innerHTML = "";
    ideasGlobales = [];
    posiciones.length = 0;
    vistos.clear();
    totalEl.textContent = "0";

    entrada.classList.remove("oculta");
    cieloUI.classList.remove("visible");
    resultadoWrap.classList.remove("visible");
  } catch (error) {
    console.error(error);
    alert("No se pudo reiniciar.");
  }
}

/* =========================
   CHATBOT IA (BASE)
========================= */
window.preguntarIA = async function () {
  const pregunta = document.getElementById("pregunta")?.value?.trim();
  const chat = document.getElementById("chat-box");

  if (!pregunta || !chat) return;

  chat.innerHTML += `<div><strong>Tú:</strong> ${escapeHTML(pregunta)}</div>`;

  let respuesta = "Solo puedo responder preguntas relacionadas con brainstorming.";

  const permitidas = [
    "brainstorming",
    "lluvia de ideas",
    "ideas",
    "creatividad",
    "grupo",
    "colaborativo"
  ];

  const valida = permitidas.some((p) =>
    pregunta.toLowerCase().includes(p)
  );

  if (valida) {
    respuesta = "El brainstorming es una técnica colaborativa que permite generar ideas libremente para resolver problemas y construir soluciones en grupo.";
  }

  chat.innerHTML += `<div><strong>Bot:</strong> ${respuesta}</div>`;
  chat.scrollTop = chat.scrollHeight;
};
