import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useAudioEngine } from '../../state/audio-engine';
import { useMediaPlayerStore } from '../../state/media-player';

function AudioBars() {
   const barsRef = useRef<THREE.Group>(null);
   const barCount = 128;
   const radius = 3.2;

   const barData = useMemo(() => {
      return Array.from({ length: barCount }, (_, i) => {
         const angle = (i / barCount) * Math.PI * 2;
         return {
            position: [
               Math.cos(angle) * radius,
               Math.sin(angle) * radius,
               0
            ] as [number, number, number],
            rotation: [0, 0, angle] as [number, number, number]
         };
      });
   }, []);

   useFrame(({ clock }) => {
      if (!barsRef.current) return;
      const data = useAudioEngine.getState().getFrequencyData();
      if (!data || data.length === 0) return;

      barsRef.current.children.forEach((mesh, i) => {
         if (!(mesh instanceof THREE.Mesh)) return;

         const dataIndex = Math.floor((i / barCount) * (data.length / 1.5));
         const value = data[dataIndex] || 0;

         const intensity = (value / 255);
         const targetScale = 0.05 + (intensity * 4);

         mesh.scale.set(1, targetScale, 1);

         const hue = 0.55 + (intensity * 0.15) + (Math.sin(clock.getElapsedTime() * 0.2) * 0.05);
         (mesh.material as THREE.MeshStandardMaterial).color.setHSL(hue, 0.8, 0.5);
         (mesh.material as THREE.MeshStandardMaterial).emissive.setHSL(hue, 0.8, 0.3);
         (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity * 4;
      });

      barsRef.current.rotation.z += 0.001;
   });

   return (
      <group ref={barsRef}>
         {barData.map((data, i) => (
            <mesh key={i} position={data.position} rotation={data.rotation}>
               <boxGeometry args={[0.04, 1, 0.1]} />
               <meshStandardMaterial
                  color="#0ea5e9"
                  emissive="#0ea5e9"
                  emissiveIntensity={1}
                  toneMapped={false}
               />
            </mesh>
         ))}
      </group>
   );
}

function CentralVinyl() {
   const meshRef = useRef<THREE.Mesh>(null);

   useFrame(() => {
      if (!meshRef.current) return;
      const data = useAudioEngine.getState().getFrequencyData();
      const avg = data.length > 0 ? data.slice(0, 10).reduce((a, b) => a + b, 0) / 10 : 0;
      const pulse = 1 + (avg / 255) * 0.15;
      meshRef.current.scale.set(pulse, pulse, pulse);
      meshRef.current.rotation.z -= 0.01;
   });

   return (
      <group>
         <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[2.8, 2.8, 0.1, 64]} />
            <meshStandardMaterial
               color="#0a0a0a"
               roughness={0.2}
               metalness={0.8}
            />
         </mesh>
         {/* Center Label Area */}
         <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.06]}>
            <cylinderGeometry args={[1, 1, 0.01, 32]} />
            <meshStandardMaterial color="#1a1a1a" emissive="#0ea5e9" emissiveIntensity={0.2} />
         </mesh>
      </group>
   );
}

export function Visualizer() {
   const status = useMediaPlayerStore(state => state.status);
   const isPlaying = status === 'playing';

   return (
      <div className="w-[600px] h-[600px] pointer-events-none relative flex items-center justify-center animate-fade-in">
         {/* Background radial glow - pulses only when playing */}
         <div className={`
            absolute inset-0 bg-radial-gradient from-primary-500/10 to-transparent blur-3xl rounded-full scale-150 transition-opacity duration-1000
            ${isPlaying ? 'animate-pulse opacity-100' : 'opacity-40'}
         `} />

         <Canvas gl={{ antialias: true }}>
            <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={45} />
            <ambientLight intensity={isPlaying ? 0.4 : 0.2} />
            <pointLight position={[10, 10, 10]} intensity={isPlaying ? 2 : 0.5} color="#0ea5e9" />
            <pointLight position={[-10, -10, -10]} intensity={isPlaying ? 1 : 0.2} color="#6366f1" />

            <Float
               speed={isPlaying ? 1 : 0.5}
               rotationIntensity={isPlaying ? 0.2 : 0.1}
               floatIntensity={isPlaying ? 0.2 : 0.1}
            >
               {isPlaying && <AudioBars />}
               <CentralVinyl />
            </Float>

            <Stars
               radius={100}
               depth={50}
               count={isPlaying ? 2000 : 1000}
               factor={4}
               saturation={0}
               fade
               speed={isPlaying ? 1 : 0.2}
            />

            <ContactShadows
               position={[0, -4.5, 0]}
               opacity={isPlaying ? 0.4 : 0.2}
               scale={20}
               blur={2.5}
               far={4.5}
            />
         </Canvas>
      </div>
   );
}
