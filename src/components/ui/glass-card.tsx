import React, { PropsWithChildren } from "react";

type Props = {
  className?: string;
  as?: "div" | "section";
};

export const GlassCard: React.FC<PropsWithChildren<Props>> = ({ 
  children, 
  className = "", 
  as = "div" 
}) => {
  const Tag = as as any;
  return (
    <Tag className={`glass-card p-6 ${className}`}>
      {children}
    </Tag>
  );
};

export default GlassCard;
