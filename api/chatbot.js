/**
 * api/chatbot.js — Vercel Serverless Function
 * Usa OpenRouter (tier gratuito) — funciona desde Colombia sin restricciones
 * Variable de entorno requerida en Vercel: OPENROUTER_API_KEY
 */

const KNOWLEDGE_BASE = [
  `El brainstorming (lluvia de ideas) es una técnica creativa grupal desarrollada por Alex Osborn en 1953.
   Su objetivo es generar la mayor cantidad posible de ideas en poco tiempo, sin juzgar ni criticar durante la generación.`,
  `Las cuatro reglas fundamentales del brainstorming son:
   1. Aplazar el juicio: prohibido criticar ideas durante la sesión.
   2. Cantidad sobre calidad: generar el mayor número posible de ideas.
   3. Ideas disparatadas bienvenidas: las ideas locas pueden inspirar soluciones originales.
   4. Combinar y mejorar: construir sobre las ideas de los demás.`,
  `Técnicas populares: Brainwriting (ideas en silencio), Método 6-3-5 (6 personas, 3 ideas, 5 rondas),
   SCAMPER (Sustituir, Combinar, Adaptar, Modificar, Poner otros usos, Eliminar, Reorganizar),
   Round Robin (turnos equitativos), Reverse Brainstorming (¿cómo empeorar el problema?).`,
  `Para facilitar una sesión efectiva: define claramente el problema, grupo ideal de 5-8 personas,
   duración óptima 30-60 minutos, facilitador neutral que gestione sin generar ideas.`,
  `Errores comunes: críticas prematuras, problema mal definido, grupos homogéneos,
   dominancia de una persona (groupthink), sesiones largas, no hacer seguimiento.`,
  `El mind mapping fue popularizado por Tony Buzan. El tema va al centro y las ideas
   se ramifican hacia afuera, permitiendo ver conexiones no lineales entre conceptos.`,
  `Evaluación de ideas: dot voting, matriz impacto vs esfuerzo, análisis FODA,
   agrupación por afinidad (affinity mapping) antes de evaluar y priorizar.`,
];

function retrieve(query, k = 3) {
  const stop = new Set(["el","la","los","las","es","un","una","de","y","a","que","en","con","como","por","se","su","lo","al"]);
  const tok = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  const qTokens = new Set(tok(query));
  return KNOWLEDGE_BASE
    .map(doc => ({ doc, score: tok(doc).filter(t => qTokens.has(t)).length / (qTokens.size + 1) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(s => s.doc);
}

function buildPrompt(pregunta, ideas, chunks) {
  const contexto = chunks.join("\n\n---\n\n");
  if (ideas && ideas.length > 0) {
    const listaIdeas = ideas.map((idea, i) => `${i + 1}. ${idea}`).join("\n");
    return `Eres un experto universitario en brainstorming. Responde siempre en español.

CONTEXTO ACADÉMICO:
---
${contexto}
---

IDEAS ESCRITAS POR EL GRUPO:
${listaIdeas}

Responde con esta estructura exacta:

**1. Definición correcta de brainstorming**
**2. Concepto construido por el grupo**
**3. Comparación**
**4. Palabras y temas clave más mencionados**
**5. Conclusión académica**`;
  }
  return `Eres un asistente experto en brainstorming. Responde en español, de forma clara y útil.
Basa tu respuesta SOLO en este contexto académico:
---
${contexto}
---
PREGUNTA: ${pregunta}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { pregunta, ideas } = req.body;
  if (!pregunta) return res.status(400).json({ error: "Falta el campo 'pregunta'" });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENROUTER_API_KEY no configurada en Vercel" });

  try {
    const query = ideas?.length ? `análisis brainstorming definición ${pregunta}` : pregunta;
    const chunks = retrieve(query, 3);
    const systemPrompt = buildPrompt(pregunta, ideas, chunks);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://brainstorming-universidad.vercel.app",
        "X-Title": "Brainstorming Chatbot"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.2-3b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: pregunta }
        ],
        max_tokens: 1024,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.error?.message || `OpenRouter error ${response.status}`);
    }

    const data = await response.json();
    const respuesta = data.choices?.[0]?.message?.content;
    if (!respuesta) throw new Error("No se recibió respuesta del modelo");

    return res.status(200).json({ respuesta });

  } catch (error) {
    console.error("[chatbot]", error.message);
    return res.status(500).json({ error: error.message });
  }
}