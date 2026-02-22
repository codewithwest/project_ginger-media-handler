import { useEffect, useState } from 'react';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
    const [dots, setDots] = useState('');
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 300);

        // 1.5s Load Time as requested (transition starts at 1.5s)
        const timer = setTimeout(() => {
            setOpacity(0);
            setTimeout(onComplete, 800); // Faster exit transition
        }, 1500);

        return () => {
            clearInterval(interval);
            clearTimeout(timer);
        };
    }, [onComplete]);

    return (
        <div
            className="fixed inset-0 z-[100] bg-[#030303] flex flex-col items-center justify-center transition-opacity duration-800 ease-in-out overflow-hidden"
            style={{ opacity }}
        >
            {/* 3D Grid Perspective */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 z-0 opacity-20"
                style={{
                    backgroundImage: `linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                    transform: 'perspective(1000px) rotateX(60deg) scale(2)',
                    transformOrigin: 'bottom'
                }}
            />

            <div className="relative group z-10">
                {/* 3D Floating Layers */}
                <div className="absolute inset-0 rounded-full bg-primary-600/20 blur-[120px] animate-pulse scale-150" />

                {/* Rotating Rings */}
                <div className="absolute -inset-8 rounded-full border border-primary-500/20 animate-[spin_8s_linear_infinite]" />
                <div className="absolute -inset-12 rounded-full border border-primary-400/10 animate-[spin_12s_linear_infinite_reverse]" />

                {/* Main Logo Sphere */}
                <div className="relative w-56 h-56 rounded-full bg-[#0a0a0a]/80 backdrop-blur-3xl p-1 shadow-[0_0_80px_rgba(14,165,233,0.2)] border border-white/10 flex items-center justify-center transition-transform duration-700 group-hover:scale-110">
                    <img
                        src="http://127.0.0.1:3000/logo"
                        alt="Ginger Logo"
                        className="w-32 h-32 object-contain drop-shadow-[0_0_25px_rgba(14,165,233,0.5)] animate-premium-float"
                    />

                    {/* Inner 3D Shimmer */}
                    <div className="absolute inset-0 rounded-full overflow-hidden opacity-20 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent -skew-x-12 translate-x-[-200%] animate-[shimmer_3s_infinite]" />
                    </div>
                </div>
            </div>

            <div className="mt-16 flex flex-col items-center gap-4 z-10">
                <div className="relative">
                    <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        GINGER
                    </h1>
                </div>

                <div className="flex flex-col items-center">
                    <p className="text-[10px] font-mono text-primary-400/60 uppercase tracking-[0.5em] animate-[fade-in-up_0.8s_ease-out]">
                        Premium Media Engine
                    </p>
                    <p className="text-[9px] font-mono text-gray-500 mt-12 opacity-80">
                        Initializing Services{dots}
                    </p>
                </div>
            </div>

            {/* Premium Progress Bar */}
            <div className="absolute bottom-20 w-48 h-[1px] bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full w-24 animate-loading-slide shadow-[0_0_10px_rgba(14,165,233,0.4)]" />
            </div>

            <style>{`
                @keyframes loading-slide {
                    0% { transform: translateX(-150%); }
                    100% { transform: translateX(300%); }
                }
                @keyframes premium-float {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-12px) rotate(3deg); }
                }
                @keyframes shimmer {
                    100% { transform: translateX(200%); }
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-premium-float {
                    animation: premium-float 5s ease-in-out infinite;
                }
                .animate-loading-slide {
                    animation: loading-slide 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
                }
            `}</style>
        </div>
    );
}

