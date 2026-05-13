import { useState, useCallback, type ReactNode, type ButtonHTMLAttributes } from 'react';

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface RippleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function RippleButton({ children, onClick, className = '', ...props }: RippleButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);

    onClick?.(e);
  }, [onClick]);

  return (
    <button
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="ripple-effect"
          style={{
            left: ripple.x,
            top: ripple.y,
          }}
        />
      ))}
    </button>
  );
}
