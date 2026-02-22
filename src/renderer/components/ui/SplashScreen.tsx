import { useEffect, useState } from 'react';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
    const [dots, setDots] = useState('');
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);

        // Minimum splash time + transition
        const timer = setTimeout(() => {
            setOpacity(0);
            setTimeout(onComplete, 1000); // Wait for fade exit
        }, 3500);

        return () => {
            clearInterval(interval);
            clearTimeout(timer);
        };
    }, [onComplete]);

    return (
        <div
            className="fixed inset-0 z-[100] bg-[#020617] flex flex-col items-center justify-center transition-opacity duration-1000 ease-in-out"
            style={{ opacity }}
        >
            <div className="relative group">
                {/* Animated Glow Rings */}
                <div className="absolute inset-0 rounded-full bg-primary-500/20 blur-3xl animate-pulse scale-150" />
                <div className="absolute inset-0 rounded-full border border-primary-500/30 animate-ping opacity-40" />
                <div className="absolute inset-0 rounded-full border-2 border-primary-500/10 scale-125 animate-pulse" />

                {/* Logo Container */}
                <div className="relative w-48 h-48 rounded-full bg-gradient-to-br from-slate-900 to-black p-1 shadow-2xl border border-white/5 flex items-center justify-center overflow-hidden">
                    <img
                        src="http://127.0.0.1:3000/logo"
                        alt="Ginger Logo"
                        className="w-32 h-32 object-contain drop-shadow-[0_0_20px_rgba(14,165,233,0.5)] animate-float"
                    />
                    {/* Glass reflections */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
                </div>
            </div>

            <div className="mt-12 flex flex-col items-center gap-2">
                <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-primary-200 to-primary-500 drop-shadow-sm">
                    GINGER
                </h1>
                <div className="flex flex-col items-center">
                    <p className="text-xs font-mono text-primary-400/60 uppercase tracking-[0.3em] ml-1">
                        Media Handler v1.0.6
                    </p>
                    <p className="text-[10px] font-mono text-gray-500 mt-4">
                        Initializing Services{dots}
                    </p>
                </div>
            </div>

            {/* Progress Bar (Indeterminate) */}
            <div className="absolute bottom-20 w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full w-24 animate-loading-slide" />
            </div>

            <style>{`
        @keyframes loading-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.05); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-loading-slide {
          animation: loading-slide 2s ease-in-out infinite;
        }
      `}</style>
        </div>
    );
}
