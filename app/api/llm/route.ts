// app/api/llm/route.ts
export const dynamic = 'force-dynamic'; // Required for streaming/async operations

export async function POST(req: Request) {
  const { prompt, context, history } = await req.json();
  const DEVELOPMENT = process.env.NODE_ENV === 'development';

  // Mock response for development
  if (DEVELOPMENT) {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
    return Response.json({ 
      content: "This is a mock LLM response for development purposes. ".repeat(5),
      tokensUsed: 123
    });
  }

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
          { role: "system", content: context },
          ...history.slice(-2), // Last 2 messages
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