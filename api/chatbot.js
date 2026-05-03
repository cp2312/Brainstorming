/**
 * api/chatbot.js — Vercel Serverless Function
 * Recibe una pregunta + las ideas de Firebase y responde con Gemini.
 * Endpoint: POST /api/chatbot
 *
 * Body esperado:
 * {
 *   "pregunta": "¿Qué es el brainstorming?",
 *   "ideas": ["idea1", "idea2", ...]   ← opcional, para el análisis grupal
 * }
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = "gemini-2.0-flash";

// Base de conocimiento sobre brainstorming (RAG local)
const KNOWLEDGE_BASE = [
  `El brainstorming (lluvia de ideas) es una técnica creativa grupal desarrollada por Alex Osborn en 1953.
   Su objetivo es generar la mayor cantidad posible de ideas en poco tiempo, sin juzgar ni criticar durante la generación.
   Se publicó formalmente en el libro "Applied Imagination".`,

  `Las cuatro reglas fundamentales del brainstorming son:
   1. Aplazar el juicio: prohibido criticar ideas durante la sesión.
   2. Cantidad sobre calidad: generar el mayor número posible de ideas.
   3. Ideas disparatadas bienvenidas: las ideas locas pueden inspirar soluciones originales.
   4. Combinar y mejorar: construir sobre las ideas de los demás.`,

  `Técnicas populares de brainstorming: Brainwriting (ideas en silencio por escrito), 
   Método 6-3-5 (6 personas, 3 ideas, 5 rondas = hasta 108 ideas),
   SCAMPER (Sustituir, Combinar, Adaptar, Modificar, Poner otros usos, Eliminar, Reorganizar),
   Round Robin (turnos equitativos), Reverse Brainstorming (¿cómo empeorar el problema?).`,

  `Para facilitar una sesión efectiva: define claramente el problema antes de empezar,
   el grupo ideal es de 5 a 8 personas, la duración óptima es 30-60 minutos,
   nombra un facilitador neutral que no genere ideas sino que gestione la dinámica.`,

  `Errores comunes: permitir críticas prematuras, definir mal el problema, grupos homogéneos,
   dominancia de una persona (groupthink), sesiones demasiado largas, no hacer seguimiento de ideas.`,

  `El mind mapping (mapa mental) es una técnica visual de brainstorming popularizada por Tony Buzan.
   El tema central va al centro y las ideas se ramifican hacia afuera, permitiendo ver conexiones no lineales.`,

  `Evaluación de ideas tras el brainstorming: dot voting (votar con puntos adhesivos),
   matriz impacto vs esfuerzo, análisis FODA de las ideas más prometedoras,
   agrupación por afinidad (affinity mapping) antes de evaluar.`,
];

// ── RAG simplificado: recupera fragmentos relevantes por similitud de palabras ──
function retrieve(query, k = 3) {
  const stopWords = new Set(["el","la","los","las","es","un","una","de","y","a","que","en","con","como","por","se","su","lo","al"]);

  const tokenize = (text) =>
    text.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length > 2 && !stopWords.has(t));

  const queryTokens = new Set(tokenize(query));

  const scored = KNOWLEDGE_BASE.map((doc, i) => {
    const docTokens = tokenize(doc);
    const matches = docTokens.filter(t => queryTokens.has(t)).length;
    const score = matches / (queryTokens.size + 1);
    return { doc, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(s => s.doc);
}

// ── Construye el prompt según si hay ideas del grupo o es una pregunta libre ──
function buildPrompt(pregunta, ideas, chunks) {
  const contexto = chunks.join("\n\n---\n\n");

  if (ideas && ideas.length > 0) {
    const listaIdeas = ideas.map((idea, i) => `${i + 1}. ${idea}`).join("\n");

    return `Eres un experto universitario en brainstorming y creatividad grupal. Responde siempre en español.

CONTEXTO ACADÉMICO SOBRE BRAINSTORMING:
---
${contexto}
---

IDEAS ESCRITAS POR LOS PARTICIPANTES DEL GRUPO:
${listaIdeas}

TAREA: Analiza las ideas del grupo y responde con esta estructura exacta:

**1. Definición correcta de brainstorming**
(basada en el contexto académico)

**2. Concepto construido por el grupo**
(síntesis de lo que los participantes expresaron)

**3. Comparación**
(¿qué acertaron? ¿qué elementos faltaron?)

**4. Palabras y temas clave más mencionados**
(lista los conceptos más repetidos o relevantes)

**5. Conclusión académica**
(evaluación del nivel de comprensión del grupo)

Responde de forma clara, profesional y motivadora.`;
  }

  // Pregunta libre del chatbot
  return `Eres un asistente experto en brainstorming y creatividad. Responde SIEMPRE en español, de forma clara y útil.

INSTRUCCIONES:
- Basa tu respuesta en el contexto académico proporcionado.
- Si la pregunta no está cubierta en el contexto, indícalo y responde con lo que sí sabes.
- No inventes información que no esté en el contexto.
- Responde directamente sin mencionar que usas un contexto o que eres IA.

CONTEXTO ACADÉMICO:
---
${contexto}
---

PREGUNTA: ${pregunta}`;
}

// ── Handler principal de Vercel ──
export default async function handler(req, res) {
  // CORS — permite peticiones desde tu dominio en Vercel
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { pregunta, ideas } = req.body;

  if (!pregunta || typeof pregunta !== "string") {
    return res.status(400).json({ error: "Falta el campo 'pregunta'" });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY no configurada en las variables de entorno" });
  }

  try {
    // 1. RAG: recuperar fragmentos relevantes
    const query = ideas?.length
      ? `análisis brainstorming definición ${pregunta}`
      : pregunta;

    const chunks = retrieve(query, 3);

    // 2. Construir prompt
    const systemPrompt = buildPrompt(pregunta, ideas, chunks);

    // 3. Llamar a Gemini
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: pregunta }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.json();
      throw new Error(err?.error?.message || `Gemini error ${geminiRes.status}`);
    }

    const data = await geminiRes.json();
    const respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!respuesta) throw new Error("Gemini no devolvió respuesta");

    return res.status(200).json({ respuesta });

  } catch (error) {
    console.error("[chatbot] Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}