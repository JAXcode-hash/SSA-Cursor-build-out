export function localChatUrl(base: string): string {
  const trimmed = base.replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? `${trimmed}/chat/completions` : `${trimmed}/v1/chat/completions`;
}

export async function localChat(system: string, user: string): Promise<string | null> {
  const base = process.env.LOCAL_OPENAI_BASE_URL;
  if (!base || process.env.MODEL_ROUTE !== "local") return null;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.LOCAL_OPENAI_API_KEY) {
    headers.authorization = `Bearer ${process.env.LOCAL_OPENAI_API_KEY}`;
  }
  const response = await fetch(localChatUrl(base), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: process.env.LOCAL_MODEL_ID ?? "qwen",
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return body.choices?.[0]?.message?.content ?? null;
}
