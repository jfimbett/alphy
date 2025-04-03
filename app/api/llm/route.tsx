// File: app/api/llm/route.tsx
import { NextResponse } from 'next/server';
import pool from '@/utils/db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';  // <-- For hashing our prompt

export const dynamic = 'force-dynamic';

const DEBUG_MODE_CREATE = process.env.NEXT_PUBLIC_DEBUG_MODE_CREATE === 'true';
const DEBUG_LOG_FILE = 'debug-responses.jsonl';


interface DeepSeekError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}
function generateCacheKey({
  model,
  prompt,
  requestType,
  context
}: {
  model: string;
  prompt: string;
  requestType?: string;
  context?: string;
}): string {
  const raw = `${model}__${requestType ?? ''}__${context ?? ''}__${prompt}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Returns the full file path for a given hash key.
 * We store in /data/cache by default; create that folder if it doesn’t exist.
 */
function getCacheFilePath(hashKey: string): string {
  const cacheDir = path.join(process.cwd(), 'data', 'cache');
  return path.join(cacheDir, `${hashKey}.json`);
}

/**
 * Attempts to read a cached response. Returns `null` if not found or parsing fails.
 */
function readFromCache(hashKey: string): { content: string; tokensUsed: number; responseTime: number } | null {
  const filePath = getCacheFilePath(hashKey);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Cache read/parse error:', err);
    return null;
  }
}

/**
 * Writes LLM response data to the cache as JSON.
 */
function writeToCache(
  hashKey: string,
  data: { content: string; tokensUsed: number; responseTime: number }
): void {
  const filePath = getCacheFilePath(hashKey);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}


function logLLMCall({
  prompt,
  model,
  requestType,
  userId,
  response,
  error,
  logId
}: {
  prompt: string;
  model: string;
  requestType: string;
  userId: string | null;
  response?: string;
  error?: string;
  logId?: string;
}) {
  try {
    const logsDir = path.join(process.cwd(), 'logs'); 
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
      
    const logFile = path.join(logsDir, 'llm-logs.txt');
    const timestamp = new Date().toISOString();

    let logEntry = `[${timestamp}] ${model} ${requestType}\n`;
    logEntry += `Prompt: ${prompt}\n`;
    if (response) logEntry += `Response: ${response}\n`;
    if (error) logEntry += `Error: ${error}\n`;
    logEntry += '----------------------------------------\n';

    fs.appendFileSync(logFile, logEntry, 'utf8');

    // 2) Structured debug logging when in create mode
    if (DEBUG_MODE_CREATE) {
      const debugFile = path.join(logsDir, DEBUG_LOG_FILE);
      const debugEntry = {
        timestamp,
        model,
        requestType,
        userId,
        logId,
        prompt,
        response,
        error
      };
      
      fs.appendFileSync(
        debugFile,
        JSON.stringify(debugEntry) + '\n',
        'utf8'
      );
    }
  } catch (err) {
    console.error('Failed to write LLM call log:', err);
  }
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, context, history, model, format, requestType, logId, skipCache } = body || {};
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
  }

  const userId = req.headers.get('x-user-id');
  const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'true';

  // === CACHING LOGIC BELOW ===
  // Generate cache key regardless of skipCache to handle errors
  const cacheKey = generateCacheKey({ model, prompt, requestType, context });
  
  // If skipCache is NOT set, check cache first
  let cached = null;
  if (!skipCache) {
    cached = readFromCache(cacheKey);
    if (cached) {
      return NextResponse.json({
        content: cached.content,
        tokensUsed: cached.tokensUsed,
        responseTime: cached.responseTime
      });
    }
  }

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
      logId
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
      const responseText = await response.text(); // Get raw response text

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
          logId
        });
        return NextResponse.json(
          { error: `DeepSeek API Error: ${response.statusText}`, details: responseText },
          { status: 500 }
        );
      }

      // Attempt to parse the JSON response from API
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
          logId
        });

        // Write to cache only if skipCache is false AND parsing succeeded
        if (!skipCache && cacheKey) {
          writeToCache(cacheKey, {
            content,
            tokensUsed: data.usage?.total_tokens || 0,
            responseTime
          });
        }

        return NextResponse.json({
          content,
          tokensUsed: data.usage?.total_tokens || 0,
          responseTime,
        });
      } catch (parseError) {
        // Write raw response to cache for debugging even if skipCache is true
        writeToCache(cacheKey, {
          content: responseText,
          tokensUsed: 0,
          responseTime
        });

        logLLMCall({
          prompt,
          model,
          requestType: requestType || 'unknown',
          userId,
          error: `Response JSON Parse Error: ${String(parseError)}`,
          response: responseText,
          logId
        });

        return NextResponse.json(
          {
            error: 'Failed to parse API response',
            response: responseText,
            cacheFileName: `${cacheKey}.json` // Include cache filename
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
      logId
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
