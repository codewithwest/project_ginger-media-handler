
import { useEffect, useRef } from 'react';
import { useAudioEngine } from '../../state/audio-engine';
import { useMediaPlayerStore } from '../../state/media-player';

export function Visualizer() {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const status = useMediaPlayerStore(state => state.status);
   const animationRef = useRef<number | null>(null);

   useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const render = () => {
         const data = useAudioEngine.getState().getFrequencyData();
         const width = canvas.width;
         const height = canvas.height;
         const centerX = width / 2;
         const centerY = height / 2;
         const radius = Math.min(width, height) / 4;

         ctx.clearRect(0, 0, width, height);

         if (!data || data.length === 0) {
            // Draw a static subtle circle when no data
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(14, 165, 233, 0.1)';
            ctx.lineWidth = 2;
            ctx.stroke();
            animationRef.current = requestAnimationFrame(render);
            return;
         }

         const barCount = Math.min(data.length, 128); // Limit bars for better circle look
         const angleStep = (Math.PI * 2) / barCount;

         // Draw outer glow
         const avgAmplitude = data.reduce((a, b) => a + b, 0) / data.length;
         const pulse = (avgAmplitude / 255) * 20;

         const gradientGlow = ctx.createRadialGradient(centerX, centerY, radius, centerX, centerY, radius + 100);
         gradientGlow.addColorStop(0, 'rgba(14, 165, 233, 0.1)');
         gradientGlow.addColorStop(1, 'rgba(14, 165, 233, 0)');
         ctx.fillStyle = gradientGlow;
         ctx.beginPath();
         ctx.arc(centerX, centerY, radius + 100 + pulse, 0, Math.PI * 2);
         ctx.fill();

         for (let i = 0; i < barCount; i++) {
            const value = data[i];
            const barHeight = (value / 255) * radius * 1.5;
            const angle = i * angleStep;

            const xStart = centerX + Math.cos(angle) * (radius + 2);
            const yStart = centerY + Math.sin(angle) * (radius + 2);
            const xEnd = centerX + Math.cos(angle) * (radius + barHeight + 2);
            const yEnd = centerY + Math.sin(angle) * (radius + barHeight + 2);

            // Gradient for bars
            const gradient = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
            gradient.addColorStop(0, '#0ea5e9');
            gradient.addColorStop(0.5, '#6366f1');
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0.2)');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(xStart, yStart);
            ctx.lineTo(xEnd, yEnd);
            ctx.stroke();

            // Optional: Dot at the end of each bar for extra detail
            ctx.beginPath();
            ctx.arc(xEnd, yEnd, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
         }

         // Inner circle "3D" effect
         const innerGradient = ctx.createRadialGradient(centerX - 10, centerY - 10, 5, centerX, centerY, radius);
         innerGradient.addColorStop(0, '#1e293b');
         innerGradient.addColorStop(1, '#0f172a');

         ctx.fillStyle = innerGradient;
         ctx.beginPath();
         ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
         ctx.fill();

         ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
         ctx.lineWidth = 2;
         ctx.stroke();

         animationRef.current = requestAnimationFrame(render);
      };

      if (status === 'playing') {
         animationRef.current = requestAnimationFrame(render);
      } else {
         if (animationRef.current) cancelAnimationFrame(animationRef.current);
      }

      return () => {
         if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
   }, [status]);

   return (
      <canvas
         ref={canvasRef}
         className="w-[500px] h-[500px] pointer-events-none"
         width={1000}
         height={1000}
      />
   );
}
