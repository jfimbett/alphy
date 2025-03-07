// app/api/llm/route.ts
import { NextResponse } from 'next/server'
import pool from '@/utils/db';

export const dynamic = 'force-dynamic';

interface DeepSeekError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export async function POST(req: Request) {
  const body = await req.json();
  const { prompt, context, history, model, format, requestType } = body || {};

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: "Invalid prompt" }, { status: 300 });
  }

  const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'true';
  const userId = req.headers.get('x-user-id');

  if (DEVELOPMENT) {
    await new Promise(res => setTimeout(res, 500));
    return NextResponse.json({
      content: `[MOCK RESPONSE] ${model || 'no-model'} response...`,
      tokensUsed: 42
    });
  }

  try {
    
    if (model?.startsWith('deepseek:')) {
      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      if (!deepseekKey) {
        console.error('DeepSeek API key missing');
        return NextResponse.json(
          { error: 'DeepSeek API key not configured' },
          { status: 500 }
        );
      }

      const modelName = model.replace('deepseek:', '');
      const messages = [
        { role: 'system', content: context || 'You are a helpful assistant.' },
        ...(Array.isArray(history) ? history : []),
        { role: 'user', content: prompt }
      ];

      const requestPayload = {
        model: modelName,
        messages,
        temperature: 0.0,
        max_tokens: 8000,
        stream: false,
        //response_format: format === 'json' ? { type: 'json_object' } : undefined
      };

      const startTime = Date.now();
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify(requestPayload)
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();
      
      

      if (!response.ok) {
        console.error('DeepSeek API Error Details:', {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText
        });
        return NextResponse.json(
          { error: `DeepSeek API Error: ${response.statusText}`, details: responseText },
          { status: 500 }
        );
      }

      try {
        if (requestType === 'consolidation') {
        console.log('Consolidation Response:', responseText);
        }

        const data = JSON.parse(responseText);

        let content = '';

        if (requestType === 'consolidation') {
          const rawContent = data.choices[0].message.content;
          content = rawContent.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
          
          // Validate basic structure
          if (!content.startsWith('[') || !content.endsWith(']')) {
            console.error('Invalid consolidation structure:', content);
            content = '[]'; // Return empty array as fallback
          }
        }

        if (requestType === 'summarize') {
          // For summaries, use the message content directly
          content = data.choices[0].message.content;
        } else if (requestType === 'consolidation' || requestType === 'extract') {
           // For structured data, clean JSON formatting
          const rawContent = data.choices[0].message.content;
          content = rawContent.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        } else {
          content = data.choices[0].message.content;
        }

        return NextResponse.json({
          content: content,
          tokensUsed: data.usage?.total_tokens || 0
        });
      } catch (parseError) {
        if (requestType === 'summarize') {
          return NextResponse.json({
            content: responseText, // Return raw text if JSON parse fails
            tokensUsed: 0
          });
        }
        console.error('Response JSON Parse Error:', parseError);
        return NextResponse.json(
          { error: 'Failed to parse API response', response: responseText },
          { status: 500 }
        );
      }
    }

    if (model?.startsWith('openai:')) {
      // commented for now
    }

    return NextResponse.json(
      { error: 'Unsupported model provider' },
      { status: 400 }
    );

  } catch (error) {
    console.error('LLM Processing Error:', error);
    return NextResponse.json(
      { error: 'LLM processing failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}