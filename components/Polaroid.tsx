import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface Props {
  url: string;
  targetPosition: THREE.Vector3;
  targetRotation: THREE.Vector3;
  isFocused: boolean;
}

const Polaroid: React.FC<Props> = ({ url, targetPosition, targetRotation, isFocused }) => {
  const group = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [hovered, setHover] = useState(false);
  
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let isMounted = true;
    
    loader.load(
      url,
      (tex) => {
        if (isMounted) {
          tex.colorSpace = THREE.SRGBColorSpace;
          // Ensure texture wraps correctly if aspect ratio differs, though usually we want cover
          tex.minFilter = THREE.LinearFilter;
          setTexture(tex);
        }
      },
      undefined,
      (err) => {
        console.warn(`Failed to load texture for ${url}`, err);
      }
    );

    return () => {
      isMounted = false;
    };
  }, [url]);

  // Random float offset
  const floatOffset = useMemo(() => Math.random() * 100, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Lerp Position
    group.current.position.lerp(targetPosition, delta * 3.0);
    
    // Lerp Rotation
    const rot = group.current.rotation;
    rot.x = THREE.MathUtils.lerp(rot.x, targetRotation.x, delta * 3.0);
    rot.y = THREE.MathUtils.lerp(rot.y, targetRotation.y, delta * 3.0);
    rot.z = THREE.MathUtils.lerp(rot.z, targetRotation.z, delta * 3.0);

    // Idle Animation
    if (!isFocused) {
      group.current.position.y += Math.sin(time + floatOffset) * 0.002;
      group.current.rotation.z += Math.cos(time * 0.5 + floatOffset) * 0.001;
    }
    
    // Scale Logic
    const targetScale = isFocused ? 1.5 : (hovered ? 1.2 : 1.0);
    const currentScale = group.current.scale;
    currentScale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
  });

  // Dimensions: Width 1.0, Height 1.2 (scaled down from previous 3.5x4.2)
  const frameWidth = 1.0;
  const frameHeight = 1.2;
  const frameDepth = 0.04;
  const photoSize = 0.85;

  return (
    <group 
      ref={group} 
      position={targetPosition} 
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Paper Frame */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[frameWidth, frameHeight, frameDepth]} />
        <meshStandardMaterial color="#fdfbf7" roughness={0.6} metalness={0.0} />
      </mesh>

      {/* Photo Image - Shifted up to create the "chin" */}
      <mesh position={[0, 0.1, frameDepth / 2 + 0.001]}>
        <planeGeometry args={[photoSize, photoSize]} />
        {texture ? (
          <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
        ) : (
          <meshStandardMaterial color="#202020" />
        )}
      </mesh>

      {/* Glossy Overlay for photo */}
      <mesh position={[0, 0.1, frameDepth / 2 + 0.002]}>
        <planeGeometry args={[photoSize, photoSize]} />
        <meshPhysicalMaterial 
          transparent 
          opacity={0.2} 
          roughness={0.0} 
          metalness={0.5} 
          clearcoat={1.0} 
        />
      </mesh>
      
      {/* Label when focused */}
      {isFocused && (
        <Html position={[0, -0.8, 0]} center transform className="pointer-events-none">
          <div className="font-serif text-gold-300 text-sm bg-black/80 px-3 py-1 rounded-full whitespace-nowrap border border-gold-500/30">
             Merry Christmas
          </div>
        </Html>
      )}
    </group>
  );
};

export default Polaroid;