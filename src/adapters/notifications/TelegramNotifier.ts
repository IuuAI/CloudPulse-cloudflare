export async function sendTelegramNotification(
  token: string | undefined,
  chatId: string | undefined,
  text: string,
  parseMode = 'HTML'
): Promise<{ status: 'sent' | 'skipped' | 'error'; error?: string }> {
  if (!token || !chatId) {
    return { status: 'skipped', error: 'Telegram bot token or chat ID not configured.' };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });

    const data: any = await response.json();
    if (data.ok) {
      return { status: 'sent' };
    } else {
      return { status: 'error', error: data.description || 'Telegram API returned not ok' };
    }
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}
