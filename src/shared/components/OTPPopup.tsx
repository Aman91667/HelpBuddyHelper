import { useEffect, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OTPPopupProps {
  otp: string;
  phone: string;
  onClose: () => void;
  duration?: number; // ms
}

export default function OTPPopup({
  otp,
  phone,
  onClose,
  duration = 30000,
}: OTPPopupProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(Math.ceil(duration / 1000));

  useEffect(() => {
    const timer = setTimeout(onClose, duration);

    const countdown = setInterval(() => {
      setTimeLeft((t) => (t > 1 ? t - 1 : 0));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(countdown);
    };
  }, [duration, onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(otp);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md p-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            OTP sent
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            to {phone}
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* OTP Box */}
      <div className="mt-4 flex items-center justify-between border border-gray-300 dark:border-gray-600 rounded px-3 py-2">
        <span className="font-mono text-lg tracking-widest text-gray-900 dark:text-gray-100">
          {otp}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-7 w-7"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
        </Button>
      </div>

      {/* Footer */}
      <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
        Expires in {timeLeft}s
      </p>
    </div>
  );
}
