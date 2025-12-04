'use client';

import { useEffect, useState } from 'react';

interface CelebrationAnimationProps {
  show: boolean;
  onComplete?: () => void;
}

export function CelebrationAnimation({ show, onComplete }: CelebrationAnimationProps) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    left: number;
    delay: number;
    duration: number;
    rotation: number;
    symbol: string;
  }>>([]);

  useEffect(() => {
    if (show) {
      const symbols = ['£', '💰', '💵', '💷', '💸', '✨', '🎉'];
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        rotation: Math.random() * 360,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
      }));
      setParticles(newParticles);

      const timeout = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute text-2xl animate-fall"
          style={{
            left: `${particle.left}%`,
            top: '-50px',
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            transform: `rotate(${particle.rotation}deg)`,
          }}
        >
          {particle.symbol}
        </div>
      ))}

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce-scale">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-4 rounded-lg shadow-2xl text-center">
          <div className="text-4xl font-bold mb-2">🎉 Deal Won! 🎉</div>
          <div className="text-xl">Cha-ching! 💰</div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes bounce-scale {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
          }
        }

        .animate-fall {
          animation: fall linear forwards;
        }

        .animate-bounce-scale {
          animation: bounce-scale 0.6s ease-in-out 3;
        }
      `}</style>
    </div>
  );
}
