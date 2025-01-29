// utils/localLLM.ts
interface LLMResponse {
  message: {
    content: string;
  };
  error?: string;
}

export async function callLocalLLM(prompt: string): Promise<string> {
  try {
    const body = {
      model: "deepseek-r1:70b",
      stream: false,
      temperature: 0.0,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    };

    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`API Error: ${res.status} ${res.statusText}`);
    }

    const responseJson: LLMResponse = await res.json();
    
    if (responseJson.error) {
      throw new Error(responseJson.error);
    }

    return responseJson.message?.content || '';
  } catch (error) {
    console.error('LLM API Call Error:', error);
    throw new Error(`Failed to process request: ${(error as Error).message}`);
  }
}