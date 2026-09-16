/**
 * Resolves Telegram Bot Token from execution context or process environment,
 * strictly keeping token secrets out of D1 persistence.
 */
export function resolveTelegramBotToken(c?: any): string {
  const runtimeEnv = c && c.env && typeof c.env === 'object' ? c.env : {};
  return (
    runtimeEnv.TELEGRAM_BOT_TOKEN ||
    (typeof process !== 'undefined' && process.env ? process.env.TELEGRAM_BOT_TOKEN : '') ||
    ''
  );
}

/**
 * Safely sanitizes raw text for Telegram HTML mode, escaping unallowed <, >, and &
 * while keeping valid supported tags: <b>, <i>, <code>, <s>, <u>, <pre>, <a>
 */
export function sanitizeTelegramHtml(raw: string): string {
  // Replace standalone & not part of an entity
  let text = raw.replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, '&amp;');

  // Replace < and > that are not part of valid Telegram HTML tags
  const validTagPattern = /<\/?(b|strong|i|em|u|ins|s|strike|del|span|tg-spoiler|a|code|pre)(\s+[^>]*)?>/gi;
  
  // Split by valid tags and encode the raw chunks
  const tokens: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = validTagPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const rawChunk = text.substring(lastIndex, match.index);
      tokens.push(rawChunk.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    }
    tokens.push(match[0]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const rawChunk = text.substring(lastIndex);
    tokens.push(rawChunk.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  }

  return tokens.join('');
}

export async function sendTelegramNotification(
  token: string | undefined,
  chatId: string | undefined,
  text: string,
  parseMode = 'HTML'
): Promise<{ status: 'sent' | 'skipped' | 'error'; error?: string }> {
  if (!token || !chatId) {
    return { status: 'skipped', error: 'Telegram bot token or chat ID not configured.' };
  }

  const sanitizedText = parseMode === 'HTML' ? sanitizeTelegramHtml(text) : text;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: sanitizedText,
        parse_mode: parseMode,
      }),
      signal: AbortSignal.timeout(8000),
    });

    let data: any = await response.json();
    if (data.ok) {
      return { status: 'sent' };
    }

    // If Telegram rejects entities formatting (e.g., bad custom HTML tags), fallback to plain text retry
    if (parseMode && data.description && data.description.includes("can't parse entities")) {
      const fallbackResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.replace(/<[^>]*>/g, ''), // Strip tags for clean plain text delivery
        }),
        signal: AbortSignal.timeout(8000),
      });
      const fallbackData: any = await fallbackResponse.json();
      if (fallbackData.ok) {
        return { status: 'sent' };
      }
    }

    return { status: 'error', error: data.description || 'Telegram API returned not ok' };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}
