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
    const response = await fetch("https://api.anthropic.com/v1/messages", {
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

Solo respondes preguntas sobre brainstorming.

Si preguntan algo fuera del tema responde:

"Solo puedo responder preguntas relacionadas con brainstorming."

Pregunta:
${pregunta}
`
          }
        ]
      })
    });

    const data = await response.json();

    const respuesta = data.content
      ?.filter(item => item.type === "text")
      ?.map(item => item.text)
      ?.join("\n");

    return res.status(200).json({
      respuesta
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message
    });
  }
}