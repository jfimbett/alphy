// File: app/api/llm/route.tsx
import { NextResponse } from 'next/server';
import pool from '@/utils/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface DeepSeekError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

// -------------
// NEW HELPER: logLLMCall
// -------------
function logLLMCall({
  prompt,
  model,
  requestType,
  userId,
  response,
  error,
}: {
  prompt: string;
  model: string;
  requestType: string;
  userId: string | null;
  response?: string;
  error?: string;
}) {
  try {
    const logsDir = path.join(process.cwd(), 'logs'); 
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }
    const logFile = path.join(logsDir, 'llm-logs.txt');

    const timestamp = new Date().toISOString();
    let logEntry = `\n[${timestamp}] MODEL: ${model}, USER: ${userId ?? 'Unknown'}, REQUEST_TYPE: ${requestType}\n`;
    logEntry += `Prompt:\n${prompt}\n`;

    if (response) {
      logEntry += `Response:\n${response}\n`;
    }
    if (error) {
      logEntry += `Error:\n${error}\n`;
    }
    logEntry += '\n-----------------------------------------------------\n';

    // Append sync or async are both valid. Sync is simpler but can block; 
    // for small logs, it usually won't be an issue:
    fs.appendFileSync(logFile, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to write LLM call log:', err);
  }
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (error) {
    // If the request body is invalid JSON, return 400
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, context, history, model, format, requestType } = body || {};
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
  }

  const userId = req.headers.get('x-user-id');
  const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'true';

  // -------------
  // For local dev/test: Mock response quickly
  // -------------
  if (DEVELOPMENT) {
    // Log the call in dev mode anyway
    logLLMCall({
      prompt,
      model: model || 'no-model',
      requestType: requestType || 'unknown',
      userId,
      response: '[MOCKED] No actual LLM call made',
    });

    await new Promise(res => setTimeout(res, 500));
    return NextResponse.json({
      content: `[MOCK RESPONSE] ${model || 'no-model'} response...`,
      tokensUsed: 42,
    });
  }

  // -------------
  // Actual LLM call
  // -------------
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
        { role: 'user', content: prompt },
      ];

      const requestPayload = {
        model: modelName,
        messages,
        temperature: 0.0,
        max_tokens: 8000,
        stream: false,
        // For "json" format, you'd generally let the system or user instructions 
        // shape the output. (DeepSeek doesn't use `response_format` like OpenAI)
      };

      const startTime = Date.now();
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify(requestPayload),
      });
      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      if (!response.ok) {
        console.error('DeepSeek API Error Details:', {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText,
        });
        // Log the failed call
        logLLMCall({
          prompt,
          model,
          requestType: requestType || 'unknown',
          userId,
          error: `DeepSeek API Error: ${response.statusText}\nBody: ${responseText}`,
        });
        return NextResponse.json(
          { error: `DeepSeek API Error: ${response.statusText}`, details: responseText },
          { status: 500 }
        );
      }

      // Now attempt to parse the JSON
      try {
        const data = JSON.parse(responseText);
        let content = '';

        if (requestType === 'consolidation' || requestType === 'extract') {
          // For structured data
          const rawContent = data.choices?.[0]?.message?.content || '';
          content = rawContent.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        } else {
          // Summaries, chat, etc.
          content = data.choices?.[0]?.message?.content || '';
        }

        // Log the successful call
        logLLMCall({
          prompt,
          model,
          requestType: requestType || 'unknown',
          userId,
          response: content,
        });

        return NextResponse.json({
          content,
          tokensUsed: data.usage?.total_tokens || 0,
          responseTime,
        });
      } catch (parseError) {
        // If parse fails, log the error but return the raw text
        logLLMCall({
          prompt,
          model,
          requestType: requestType || 'unknown',
          userId,
          error: `Response JSON Parse Error: ${String(parseError)}`,
          response: responseText,
        });
        return NextResponse.json(
          {
            error: 'Failed to parse API response',
            response: responseText,
          },
          { status: 500 }
        );
      }
    }

    // If we eventually supported openai: or other, handle here...
    return NextResponse.json({ error: 'Unsupported model provider' }, { status: 400 });
  } catch (error: any) {
    // Log any top-level error
    logLLMCall({
      prompt,
      model: model || 'unknown',
      requestType: requestType || 'unknown',
      userId,
      error: String(error),
    });

    console.error('LLM Processing Error:', error);
    return NextResponse.json(
      {
        error: 'LLM processing failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
