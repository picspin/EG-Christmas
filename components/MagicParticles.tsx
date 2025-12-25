import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppMode, FeatureShape } from '../types';
import { getShapePositions } from '../utils/geometry';

interface Props {
  mode: AppMode;
  shape: FeatureShape;
  count?: number; 
  params: {
    color: string;
    metalness: number;
    roughness: number;
    speed: number;
  };
}

const MagicParticles: React.FC<Props> = ({ mode, shape, count = 8000, params }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // High density, tiny dust - Optimized count for performance
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  
  // Cache shape positions with high spread for "volume" look
  const shapesCache = useMemo(() => ({
    [FeatureShape.TREE]: getShapePositions(count, FeatureShape.TREE, 1.5),
    [FeatureShape.SANTA]: getShapePositions(count, FeatureShape.SANTA, 1.2),
    [FeatureShape.SOCK]: getShapePositions(count, FeatureShape.SOCK, 1.2),
    [FeatureShape.ELK]: getShapePositions(count, FeatureShape.ELK, 1.2),
  }), [count]);

  // Initial Scatter Positions (Nebula)
  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      positions[i * 3] = r * Math.cos(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.sin(phi);
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.cos(phi);
    }
  }, [count, positions]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();
    const lerpFactor = 0.02 * params.speed;

    for (let i = 0; i < count; i++) {
      let tx = 0, ty = 0, tz = 0;

      if (mode === AppMode.SCATTER) {
        // Spiral Galaxy / Milky Way effect
        const arms = 5;
        const spinSpeed = 0.2;
        const armOffset = (i % arms) * (Math.PI * 2 / arms);
        
        const dist = (i / count) * 30; // Distance from core
        const angle = dist * 0.4 + armOffset + (time * spinSpeed * (30/(dist+1)));
        
        // Random spread from the arm center
        const spread = 0.5 + (dist * 0.1); 
        
        tx = Math.cos(angle) * dist + (Math.random() - 0.5) * spread;
        ty = (Math.sin(time + dist * 0.5) * 2) * Math.exp(-dist * 0.1) + (Math.random() - 0.5) * spread; 
        tz = Math.sin(angle) * dist + (Math.random() - 0.5) * spread;

      } else if (mode === AppMode.FEATURE) {
        const shapeData = shapesCache[shape];
        // Retrieve base position
        tx = shapeData[i * 3];
        ty = shapeData[i * 3 + 1];
        tz = shapeData[i * 3 + 2];
        
        // Add twinkling movement
        tx += Math.sin(time * 2 + i) * 0.05;
        ty += Math.cos(time * 3 + i) * 0.05;
        tz += Math.sin(time * 1.5 + i) * 0.05;

      } else if (mode === AppMode.FOCUS) {
         // Ambient background field
         const r = 25 + Math.sin(i + time) * 5;
         const theta = i * 0.1 + time * 0.05;
         tx = Math.cos(theta) * r;
         ty = (Math.random() - 0.5) * 40;
         tz = Math.sin(theta) * r;
      }

      // Lerp Position
      positions[i * 3] += (tx - positions[i * 3]) * lerpFactor;
      positions[i * 3 + 1] += (ty - positions[i * 3 + 1]) * lerpFactor;
      positions[i * 3 + 2] += (tz - positions[i * 3 + 2]) * lerpFactor;

      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      
      // Scale - Cosmic Dust is variable size
      const isGold = i % 10 < 3; 
      const baseScale = isGold ? 0.06 : 0.03;
      const scale = baseScale + Math.random() * 0.03;
      
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(time + i, time + i, 0);
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Colors: Deep Emerald, Gold, Diamond White
      const color = new THREE.Color();
      if (i % 20 < 12) {
         // Emerald (Majority)
         color.setHex(0x022c22);
         // Add subtle pulse
         color.offsetHSL(0, 0, Math.sin(time * 2 + i)*0.05);
      } else if (i % 20 < 18) {
         // Gold
         color.setHex(0xD4AF37);
         color.offsetHSL(0, 0, Math.sin(time * 5 + i)*0.1); // Sparkle
      } else {
         // White/Silver
         color.setHex(0xFFFFFF);
      }
      
      meshRef.current.setColorAt(i, color);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
      {/* Reduced segments for better performance with high count */}
      <sphereGeometry args={[1, 4, 4]} />
      <meshStandardMaterial 
        roughness={0.4}
        metalness={0.8}
        emissiveIntensity={0.5}
      />
    </instancedMesh>
  );
};

export default MagicParticles;