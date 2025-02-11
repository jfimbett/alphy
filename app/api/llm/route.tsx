// app/api/llm/route.ts
import { NextResponse } from 'next/server'
import pool from '@/utils/db';

export const dynamic = 'force-dynamic'; // Required for streaming/async operations

export async function POST(req: Request) {
  const { prompt, context, history, model } = await req.json() || {};

  // Validate parameters
  if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: "Invalid prompt" }, { status: 400 });
  }

  const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'true';
  const userId = req.headers.get('x-user-id');

  if (DEVELOPMENT) {
    console.log('Using mock LLM responses');
    await new Promise(res => setTimeout(res, 500));
    return NextResponse.json({
      content: `[MOCK RESPONSE] ${model || 'no-model'} response...`,
      tokensUsed: 42
    });
  }


      // Ensure history is an array and limit to last 2 messages
      const limitedHistory = Array.isArray(history) 
      ? history.slice(-2)
      : [];

      // Real implementation
      try {
        const apiKeyRes = await pool.query(
          `SELECT provider, decrypted_key FROM api_keys WHERE user_id = $1`,
          [userId]
        );
        

        const keyMap = Object.fromEntries(
          apiKeyRes.rows.map((row: { provider: string; decrypted_key: string }) => [
            row.provider,
            row.decrypted_key
          ])
        );

      let response;
      if (model.startsWith('local:')) {
        // Local model via Ollama
        response = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model.replace('local:', ''),
            stream: false,
            messages: [
              { role: "system", content: context || "" },
              ...history,
              { role: "user", content: prompt }
            ]
          }),
        });
      } else if (model.startsWith('openai:')) {
        // OpenAI API
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keyMap.openai}`
          },
          body: JSON.stringify({
            model: model.replace('openai:', ''),
            messages: [
              { role: "system", content: context || "" },
              ...history,
              { role: "user", content: prompt }
            ]
          })
        });
      }

        if (!response || !response.ok) throw new Error(`LLM API Error: ${response?.statusText || 'No response'}`);
        
        const data = await response.json();
        return Response.json({
          content: data.choices?.[0]?.message?.content || data.message?.content || "",
          tokensUsed: data.usage?.total_tokens || 0
        });
      } catch (error) {
        console.error('LLM Processing Error:', error);
        return Response.json(
          { error: "LLM processing failed" },
          { status: 500 }
        );
      }
    }