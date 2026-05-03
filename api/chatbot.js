/**
 * api/chatbot.js — Vercel Serverless Function
 * Usa Cloudflare Workers AI (10,000 requests/día gratis)
 * Variables de entorno requeridas en Vercel:
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN
 */

const KNOWLEDGE_BASE = [
  `El brainstorming, también conocido como lluvia de ideas, es una técnica creativa utilizada para generar muchas ideas sobre un tema o problema específico, con el objetivo principal de encontrar soluciones innovadoras mediante la participación libre de varias personas. Su principio más importante es que primero se busca la cantidad de ideas y después se evalúa su calidad.`,

  `El brainstorming fue creado por Alex Faickney Osborn en 1939, quien observó que los grupos producían mejores resultados cuando podían expresar sus pensamientos sin recibir críticas inmediatas. En 1953 publicó su libro Applied Imagination, donde explicó formalmente este método.`,

  `El brainstorming se utiliza para resolver problemas, crear estrategias, mejorar productos o servicios, innovar en proyectos y facilitar la toma de decisiones en equipo. Es muy común en empresas, universidades, marketing y tecnología.`,

  `Las reglas fundamentales del brainstorming son: no criticar ninguna idea durante la sesión, aceptar todas las propuestas, buscar la mayor cantidad posible de ideas, permitir ideas creativas o poco comunes, combinar ideas existentes y asegurar la participación de todos los integrantes.`,

  `Existen varios tipos de brainstorming: el individual, donde una sola persona genera ideas; el grupal, donde varias personas participan juntas; el digital, que se realiza mediante herramientas tecnológicas; y el inverso, que consiste en pensar primero cómo empeorar un problema para luego encontrar mejores soluciones.`,

  `El proceso del brainstorming sigue estos pasos: primero se define claramente el problema, luego se reúne al equipo, se explican las reglas, se generan ideas libremente, se registran todas las propuestas, se evalúan las mejores y finalmente se aplica la solución seleccionada.`,

  `Un ejemplo práctico de brainstorming: una tienda online que busca mejorar sus ventas realiza una sesión y surgen ideas como promociones semanales, publicidad en redes sociales, programas de puntos, mejor atención al cliente, envíos gratis y descuentos para nuevos clientes.`,

  `Las ventajas del brainstorming incluyen: fomento de la creatividad, fortalecimiento del trabajo en equipo, generación rápida de soluciones, aumento de la participación, reducción del miedo a equivocarse e impulso a la innovación constante.`,

  `Las desventajas del brainstorming son: posible desorden en las sesiones, poca participación de algunas personas, repetición de ideas, pérdida de tiempo y el hecho de que no siempre se obtienen buenas soluciones si no existe una buena organización.`,

  `Herramientas digitales para brainstorming remoto: Miro, Trello, Notion, Google Docs y Microsoft Teams permiten realizar sesiones de brainstorming de forma remota y organizada, siendo muy utilizadas actualmente por empresas y equipos distribuidos.`,

  `Caso exitoso de brainstorming — Google: utiliza esta técnica en sus equipos de innovación para desarrollar y mejorar productos como Gmail, Google Maps y Google Drive, permitiendo primero la libre generación de ideas antes de seleccionar las mejores.`,

  `Caso exitoso de brainstorming — Pixar: utiliza brainstorming creativo para desarrollar historias, personajes y escenas antes de producir sus películas, lo que ha contribuido al éxito de obras como Toy Story e Inside Out.`,

  `En conclusión, el brainstorming es una técnica sencilla pero muy poderosa que permite aprovechar la creatividad individual y grupal para encontrar mejores soluciones, mejorar procesos e impulsar la innovación, manteniéndose como una herramienta fundamental en el mundo empresarial, académico y tecnológico.`,
];

function retrieve(query, k = 3) {
  const stop = new Set(["el","la","los","las","es","un","una","de","y","a","que","en","con","como","por","se","su","lo","al","del","las","más","para","una","sus"]);
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

  const restricciones = `RESTRICCIONES IMPORTANTES:
- Solo puedes responder preguntas relacionadas con brainstorming, lluvia de ideas, creatividad grupal o los temas del contexto académico.
- Si la pregunta no tiene relación con brainstorming, responde exactamente esto: "Solo puedo responder preguntas relacionadas con brainstorming y creatividad. ¿Tienes alguna duda sobre el tema?"
- No respondas preguntas sobre otros temas como política, entretenimiento, matemáticas, recetas, etc.
- No actúes como otro tipo de asistente. Tu único rol es ser experto en brainstorming.
- Responde siempre en español.`;

  if (ideas && ideas.length > 0) {
  const listaIdeas = ideas.map((idea, i) => `${i + 1}. ${idea}`).join("\n");
  return `Eres un experto universitario en brainstorming. Responde siempre en español.

CONTEXTO ACADÉMICO:
---
${contexto}
---

IDEAS ESCRITAS POR EL GRUPO:
${listaIdeas}

Con base en las ideas del grupo y el contexto académico, redacta un único concepto breve y claro de qué es el brainstorming según lo que el grupo expresó. Máximo 5 oraciones. Sin títulos, sin listas, solo el concepto en párrafo.`;
}
  return `Eres un asistente experto en brainstorming. ${restricciones}

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

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken  = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return res.status(500).json({ error: "Faltan CLOUDFLARE_ACCOUNT_ID o CLOUDFLARE_API_TOKEN en Vercel" });
  }

  try {
    const query = ideas?.length ? `análisis brainstorming definición ${pregunta}` : pregunta;
    const chunks = retrieve(query, 3);
    const systemPrompt = buildPrompt(pregunta, ideas, chunks);

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-3b-instruct`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: pregunta }
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.errors?.[0]?.message || `Cloudflare error ${response.status}`);
    }

    const data = await response.json();
    const respuesta = data?.result?.response;

    if (!respuesta) throw new Error("Cloudflare no devolvió respuesta");

    return res.status(200).json({ respuesta });

  } catch (error) {
    console.error("[chatbot] Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}