
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useAudioEngine } from '../../state/audio-engine';
import { useMediaPlayerStore } from '../../state/media-player';

function AudioBars() {
   const barsRef = useRef<THREE.Group>(null);
   const barCount = 128;
   const radius = 3;

   const barData = useMemo(() => {
      return Array.from({ length: barCount }, (_, i) => {
         const angle = (i / barCount) * Math.PI * 2;
         return {
            position: [
               Math.cos(angle) * (radius + 0.2),
               Math.sin(angle) * (radius + 0.2),
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
         const targetScale = 0.05 + (intensity * 3.5);

         mesh.scale.set(1, targetScale, 1);

         const hue = 0.55 + (intensity * 0.15) + (Math.sin(clock.getElapsedTime() * 0.2) * 0.05);
         (mesh.material as THREE.MeshStandardMaterial).color.setHSL(hue, 0.8, 0.5);
         (mesh.material as THREE.MeshStandardMaterial).emissive.setHSL(hue, 0.8, 0.3);
         (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity * 3;
      });

      barsRef.current.rotation.z += 0.002;
      barsRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.1;
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

function CentralSphere() {
   const meshRef = useRef<THREE.Mesh>(null);

   useFrame(() => {
      if (!meshRef.current) return;
      const data = useAudioEngine.getState().getFrequencyData();
      const avg = data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0;
      const pulse = 1 + (avg / 255) * 0.2;
      meshRef.current.scale.set(pulse, pulse, pulse);
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.x += 0.005;
   });

   return (
      <mesh ref={meshRef}>
         <sphereGeometry args={[2.5, 32, 32]} />
         <meshStandardMaterial
            color="#0f172a"
            roughness={0}
            metalness={1}
            transparent
            opacity={0.9}
            emissive="#0a0a0a"
         />
      </mesh>
   );
}

export function Visualizer() {
   const status = useMediaPlayerStore(state => state.status);

   if (status !== 'playing') return null;

   return (
      <div className="w-[600px] h-[600px] pointer-events-none relative flex items-center justify-center">
         {/* Background radial glow */}
         <div className="absolute inset-0 bg-radial-gradient from-primary-500/10 to-transparent blur-3xl rounded-full scale-150 animate-pulse duration-[3000ms]" />

         <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1.5} color="#0ea5e9" />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#6366f1" />

            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
               <AudioBars />
               <CentralSphere />
            </Float>

            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <ContactShadows position={[0, -4.5, 0]} opacity={0.4} scale={20} blur={24} far={4.5} />
         </Canvas>
      </div>
   );
}
