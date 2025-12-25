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
    speed: number;
    ornamentScale: number;
  };
}

const createStarShape = () => {
  const shape = new THREE.Shape();
  const outerRadius = 1;
  const innerRadius = 0.4;
  const points = 6;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const a = (i / (points * 2)) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
};

const StructureOrnaments: React.FC<Props> = ({ mode, shape, count = 200, params }) => {
  const ballsRef = useRef<THREE.InstancedMesh>(null);
  const starsRef = useRef<THREE.InstancedMesh>(null);
  const canesRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Geometries
  const starGeometry = useMemo(() => {
    const s = createStarShape();
    const geom = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 });
    geom.center();
    return geom;
  }, []);

  const caneGeometry = useMemo(() => {
    class CaneCurve extends THREE.Curve<THREE.Vector3> {
      constructor() { super(); }
      getPoint(t: number, optionalTarget = new THREE.Vector3()) {
        const point = optionalTarget;
        if (t < 0.7) {
            point.set(0, t * 3, 0);
        } else {
            const hookT = (t - 0.7) / 0.3; 
            const r = 0.5;
            const a = hookT * Math.PI;
            point.set(r * (1 - Math.cos(a)), 2.1 + r * Math.sin(a), 0);
        }
        return point;
      }
    }
    const path = new CaneCurve();
    const geom = new THREE.TubeGeometry(path, 20, 0.15, 8, false);
    geom.center();
    return geom;
  }, []);

  // Positions Logic
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  
  // Cache targets - Use Very Low Spread (0.15) to keep ornaments TIGHT on the "branches"
  const shapesCache = useMemo(() => ({
    [FeatureShape.TREE]: getShapePositions(count, FeatureShape.TREE, 0.15),
    [FeatureShape.SANTA]: getShapePositions(count, FeatureShape.SANTA, 0.5), 
    [FeatureShape.SOCK]: getShapePositions(count, FeatureShape.SOCK, 0.5),
    [FeatureShape.ELK]: getShapePositions(count, FeatureShape.ELK, 0.3),
  }), [count]);

  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
  }, [count, positions]);

  const typeCutoff1 = Math.floor(count * 0.5); // Balls
  const typeCutoff2 = Math.floor(count * 0.75); // Stars

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const lerpSpeed = 0.04 * params.speed;
    const baseScale = params.ornamentScale || 1.0;

    for (let i = 0; i < count; i++) {
      let tx = 0, ty = 0, tz = 0;
      
      if (mode === AppMode.SCATTER) {
         // Galaxy Orbit for ornaments
         const angle = i * 0.2 + time * 0.2;
         const r = 15 + Math.sin(i) * 8;
         tx = Math.cos(angle) * r;
         ty = Math.sin(angle * 0.5) * 8;
         tz = Math.sin(angle) * r;
      } else if (mode === AppMode.FEATURE) {
         const shapeData = shapesCache[shape];
         tx = shapeData[i * 3];
         ty = shapeData[i * 3 + 1];
         tz = shapeData[i * 3 + 2];
      } else if (mode === AppMode.FOCUS) {
         // Push out to frame
         const angle = i * 0.3;
         const r = 35;
         tx = Math.cos(angle) * r;
         ty = (Math.random() - 0.5) * 30;
         tz = Math.sin(angle) * r;
      }

      positions[i * 3] += (tx - positions[i * 3]) * lerpSpeed;
      positions[i * 3 + 1] += (ty - positions[i * 3 + 1]) * lerpSpeed;
      positions[i * 3 + 2] += (tz - positions[i * 3 + 2]) * lerpSpeed;

      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      
      // Gentle spin
      dummy.rotation.set(time + i, time * 0.5 + i, i);

      // Scale Logic
      const scalePulse = Math.sin(time * 3 + i) * 0.1;
      const finalScale = (0.4 + scalePulse) * baseScale;
      dummy.scale.set(finalScale, finalScale, finalScale);

      dummy.updateMatrix();

      if (i < typeCutoff1) {
        if (ballsRef.current) {
           ballsRef.current.setMatrixAt(i, dummy.matrix);
           const ballColor = new THREE.Color();
           // Random colors
           if (i % 5 === 0) ballColor.setHex(0xD4AF37); // Gold
           else if (i % 5 === 1) ballColor.setHex(0x8B0000); // Red
           else if (i % 5 === 2) ballColor.setHex(0x064e3b); // Emerald
           else if (i % 5 === 3) ballColor.setHex(0x0F52BA); // Sapphire Blue
           else ballColor.setHex(0xC0C0C0); // Silver
           ballsRef.current.setColorAt(i, ballColor);
        }
      } else if (i < typeCutoff2) {
        if (starsRef.current) {
           starsRef.current.setMatrixAt(i - typeCutoff1, dummy.matrix);
           starsRef.current.setColorAt(i - typeCutoff1, new THREE.Color(0xD4AF37));
        }
      } else {
        if (canesRef.current) {
           canesRef.current.setMatrixAt(i - typeCutoff2, dummy.matrix);
           canesRef.current.setColorAt(i - typeCutoff2, new THREE.Color(0xFFFFFF));
        }
      }
    }

    if (ballsRef.current) {
      ballsRef.current.instanceMatrix.needsUpdate = true;
      if (ballsRef.current.instanceColor) ballsRef.current.instanceColor.needsUpdate = true;
    }
    if (starsRef.current) {
      starsRef.current.instanceMatrix.needsUpdate = true;
      if (starsRef.current.instanceColor) starsRef.current.instanceColor.needsUpdate = true;
    }
    if (canesRef.current) {
      canesRef.current.instanceMatrix.needsUpdate = true;
      if (canesRef.current.instanceColor) canesRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={ballsRef} args={[undefined, undefined, typeCutoff1]} castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial metalness={0.9} roughness={0.1} envMapIntensity={2.0} />
      </instancedMesh>

      <instancedMesh ref={starsRef} args={[undefined, undefined, typeCutoff2 - typeCutoff1]} castShadow receiveShadow>
        <primitive object={starGeometry} />
        <meshStandardMaterial metalness={1.0} roughness={0.1} color="#D4AF37" emissive="#D4AF37" emissiveIntensity={0.3} />
      </instancedMesh>

      <instancedMesh ref={canesRef} args={[undefined, undefined, count - typeCutoff2]} castShadow receiveShadow>
        <primitive object={caneGeometry} />
        <meshStandardMaterial metalness={0.5} roughness={0.2} color="#E0E0E0" />
      </instancedMesh>
    </group>
  );
};

export default StructureOrnaments;