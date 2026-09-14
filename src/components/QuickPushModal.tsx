import React, { useState } from 'react';
import { X, Send, Bot, Sparkles } from 'lucide-react';
import { sendTelegramPush } from '../api';

interface QuickPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultChatId?: string;
  onSuccess: (status: string, desc?: string) => void;
}

export const QuickPushModal: React.FC<QuickPushModalProps> = ({
  isOpen,
  onClose,
  defaultChatId,
  onSuccess,
}) => {
  const [text, setText] = useState('');
  const [chatId, setChatId] = useState(defaultChatId || '');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setIsSending(true);
    try {
      const res = await sendTelegramPush({
        text,
        chatId: chatId || undefined,
        parseMode: 'HTML',
      });
      onSuccess(
        res.status,
        res.status === 'sent'
          ? '消息已成功推送至 Telegram！'
          : '已保存至推送日志（模拟推送模式）。'
      );
      setText('');
      onClose();
    } catch (err: any) {
      onSuccess('error', err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-lg">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                即时 Telegram 广播推送
              </h3>
              <p className="text-xs text-slate-500">向 Telegram 监控群组或频道发布即时消息</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              目标会话 ID / @频道 (选填)
            </label>
            <input
              type="text"
              placeholder={defaultChatId || '@channel_or_chat_id'}
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              推送内容 (支持 HTML 格式，如 &lt;b&gt;文本&lt;/b&gt;)
            </label>
            <textarea
              required
              rows={4}
              placeholder="输入要广播的通知或报警内容..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSending || !text.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? '发送中...' : '立即推送'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
