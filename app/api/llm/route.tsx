// app/api/llm/route.ts
import { NextResponse } from 'next/server'
import pool from '@/utils/db';

export const dynamic = 'force-dynamic'; // Required for streaming/async operations



export async function POST(req: Request) {
  const body = await req.json();
  const { prompt, context, history, model } = body || {};

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
  }

  const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'true';
  const userId = req.headers.get('x-user-id');

  // === If in dev mode, return a mock response immediately
  if (DEVELOPMENT) {
    console.log('Using mock LLM responses');
    await new Promise(res => setTimeout(res, 500));
    return NextResponse.json({
      content: `[MOCK RESPONSE] ${model || 'no-model'} response...`,
      tokensUsed: 42
    });
  }

  try {
    let response: Response | null = null;

    // --------------------------------------------------------------------
    // 1) LOCAL MODEL (no API key needed)
    // --------------------------------------------------------------------
    if (model?.startsWith('local:')) {
      response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.replace('local:', ''),
          stream: false,
          format: body.format === 'json' ? 'json' : undefined,
          messages: [
            { 
              role: 'system', 
              content: body.format === 'json' ? 
                'Return response as valid JSON array. No markdown or extra text.' : 
                (context || '')
            },
            ...(Array.isArray(history) ? history : []),
            { role: 'user', content: prompt },
          ],
        }),
      });
    }

    // --------------------------------------------------------------------
    // 2) OPENAI MODEL (must fetch user’s openai key from DB)
    // --------------------------------------------------------------------
    else if (model?.startsWith('openai:')) {
      // Query the DB for the user’s key
      const apiKeyRes = await pool.query(
        `SELECT provider, decrypted_key 
         FROM api_keys 
         WHERE user_id = $1`,
        [userId]
      );
      const keyMap = Object.fromEntries(
        apiKeyRes.rows.map((row: { provider: string; decrypted_key: string }) => [
          row.provider,
          row.decrypted_key
        ])
      );

      // If no openai key found for this user, handle that gracefully
      const openaiKey = keyMap.openai;
      if (!openaiKey) {
        return NextResponse.json(
          { error: 'No OpenAI API key found for this user' },
          { status: 400 }
        );
      }

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: model.replace('openai:', ''),
          response_format: body.format === 'json' ? { type: "json_object" } : undefined,
          messages: [
            { 
              role: 'system', 
              content: body.format === 'json' ? 
                'Return response as valid JSON array. No markdown or extra text.' : 
                (context || '')
            },
            ...(Array.isArray(history) ? history : []),
            { role: 'user', content: prompt }
          ]
        })
      });
    }

    // --------------------------------------------------------------------
    // 3) If model is neither local nor openai, handle as error or fallback
    // --------------------------------------------------------------------
    else {
      return NextResponse.json(
        { error: `Unknown model type: ${model}` },
        { status: 400 }
      );
    }

    // If no response from above calls, error
    if (!response) {
      throw new Error('No response from LLM fetch');
    }
    if (!response.ok) {
      throw new Error(`LLM API Error: ${response.statusText || 'No response'}`);
    }

    // Parse JSON from the LLM response
    const data = await response.json();
    return NextResponse.json({
      content: data.choices?.[0]?.message?.content || data.message?.content || "",
      tokensUsed: data.usage?.total_tokens || 0
    });

  } catch (error) {
    console.error('LLM Processing Error:', error);
    return NextResponse.json({ error: "LLM processing failed" }, { status: 500 });
  }
}