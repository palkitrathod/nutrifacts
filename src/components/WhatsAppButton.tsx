import React, { useState } from 'react';
import { MessageCircle, ExternalLink, X, Send, Copy, Check } from 'lucide-react';
import { useEscapeToClose } from './useEscapeToClose';
import { useNutrition } from '../context/NutritionContext';

interface WhatsAppButtonProps {
  customMessage?: string;
  variant?: 'floating' | 'inline' | 'compact';
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  customMessage,
  variant = 'floating',
}) => {
  const { currentUser, isDietitian } = useNutrition();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const dietitianPhone = '919872154320';
  const defaultText =
    customMessage ||
    `Hello Dt. Anchal, I'm ${currentUser.name} reaching out via the Nutrifacts app regarding my nutrition guidance and consultation.`;

  const [message, setMessage] = useState(defaultText);

  const getWhatsAppUrl = () => {
    return `https://wa.me/${dietitianPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleOpenWhatsApp = () => {
    window.open(getWhatsAppUrl(), '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 font-medium text-xs transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5 fill-[#25D366] text-[#25D366]" />
        <span>WhatsApp Dt. Anchal</span>
      </button>
    );
  }

  if (variant === 'inline') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99]"
        >
          <MessageCircle className="w-5 h-5 fill-current" />
          <span>Chat on WhatsApp with Dt. Anchal</span>
        </button>

        {isOpen && (
          <WhatsAppModal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            message={message}
            setMessage={setMessage}
            onSend={handleOpenWhatsApp}
            onCopy={handleCopyMessage}
            copied={copied}
          />
        )}
      </>
    );
  }

  // Floating button
  return (
    <>
      <div className="fixed bottom-20 right-4 z-30 no-print">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-13 h-13 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 group focus:outline-hidden ring-4 ring-white/60"
          title="Chat with Dt. Anchal on WhatsApp"
          aria-label="Chat with Dt. Anchal on WhatsApp"
        >
          <MessageCircle className="w-6 h-6 fill-current" />
          <span className="sr-only">Chat on WhatsApp</span>
        </button>
      </div>

      {isOpen && (
        <WhatsAppModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          message={message}
          setMessage={setMessage}
          onSend={handleOpenWhatsApp}
          onCopy={handleCopyMessage}
          copied={copied}
        />
      )}
    </>
  );
};

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  setMessage: (m: string) => void;
  onSend: () => void;
  onCopy: () => void;
  copied: boolean;
}

const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  onClose,
  message,
  setMessage,
  onSend,
  onCopy,
  copied,
}) => {
  useEscapeToClose(true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="bg-[#128C7E] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Direct WhatsApp Consultation</h3>
              <p className="text-xs text-emerald-100 font-light">Dt. Anchal Dewan · Nutrifacts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Connect directly with Dt. Anchal for diet questions, meal plan queries, or urgent follow-up advice. Messages are replied during clinic hours (10:00 AM – 07:00 PM IST).
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#128C7E]/40 focus:border-[#128C7E] bg-slate-50/50 resize-none text-slate-800"
              placeholder="Type your message to Dt. Anchal..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onSend}
              className="flex-2 py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Launch WhatsApp</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
