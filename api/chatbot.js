export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  const { pregunta } = req.body;

  if (!pregunta) {
    return res.status(400).json({
      error: "Pregunta vacía"
    });
  }

  try {
    // AQUÍ debe ir la llamada real a Anthropic,
    // NO a /api/chatbot porque eso crea un bucle infinito
    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 700,
          messages: [
            {
              role: "user",
              content: `
Eres un asistente universitario especializado únicamente en brainstorming.

Solo respondes preguntas relacionadas con:
- brainstorming
- lluvia de ideas
- creatividad grupal
- trabajo colaborativo
- solución de problemas en grupo
- reglas del brainstorming
- aplicaciones del brainstorming

Si el usuario pregunta algo fuera de este tema, responde exactamente:

"Solo puedo responder preguntas relacionadas con brainstorming."

Pregunta del usuario:
${pregunta}
`
            }
          ]
        })
      }
    );

    // Verificar si Anthropic respondió bien
    const data = await response.json();

    console.log("RESPUESTA DE ANTHROPIC:", data);

    // Si Anthropic devuelve error
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Error en Anthropic"
      });
    }

    const respuesta = data.content
      ?.filter(item => item.type === "text")
      ?.map(item => item.text)
      ?.join("\n");

    return res.status(200).json({
      respuesta: respuesta || "No se recibió respuesta de la IA"
    });

  } catch (error) {
    console.error("ERROR REAL:", error);

    return res.status(500).json({
      error: error.message || "Error interno del servidor"
    });
  }
}