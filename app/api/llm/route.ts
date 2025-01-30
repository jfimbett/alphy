// app/api/llm/route.ts
export const dynamic = 'force-dynamic'; // Required for streaming/async operations

export async function POST(req: Request) {
  const { prompt, context, history } = await req.json();

  // Validate parameters
  if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: "Invalid prompt" }, { status: 400 });
  }

  const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'true';

  if (DEVELOPMENT) {
    console.log('Using mock LLM responses');
    await new Promise(resolve => setTimeout(resolve, 500));
    return Response.json({ 
      content: "[MOCK RESPONSE] This is a development mock response...",
      tokensUsed: 42
    });
  }


  // Ensure history is an array and limit to last 2 messages
  const limitedHistory = Array.isArray(history) 
  ? history.slice(-2)
  : [];

  // Real implementation
  try {
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "deepseek-r1:70b",
        stream: false,
        temperature: 0.0,
        messages: [
          { role: "system", content: context || "" }, // Handle undefined context
          ...limitedHistory,
          { role: "user", content: prompt }
        ]
      }),
    });

    if (!res.ok) throw new Error(`LLM API Error: ${res.statusText}`);
    
    const data = await res.json();
    return Response.json({
      content: data.message?.content || "",
      tokensUsed: data.tokens_used || 0
    });
  } catch (error) {
    console.error('LLM Processing Error:', error);
    return Response.json(
      { error: "LLM processing failed" },
      { status: 500 }
    );
  }
}