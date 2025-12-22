import React from 'react';

interface PremiumPageProps {
  title?: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}

// A lightweight, reusable page wrapper with a subtle gradient background,
// sensible paddings, and optional title/subtitle header. Keeps pages visually
// consistent without forcing a strict layout.
export const PremiumPage: React.FC<PremiumPageProps> = ({ title, subtitle, headerExtra, children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background pb-24 pb-safe">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {(title || subtitle || headerExtra) && (
          <div className="flex items-start justify-between gap-4">
            <div>
              {title && <h1 className="text-3xl font-bold mb-1">{title}</h1>}
              {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
            </div>
            {headerExtra}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default PremiumPage;
