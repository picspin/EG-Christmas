import React, { useRef, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import MagicParticles from './MagicParticles';
import StructureOrnaments from './StructureOrnaments';
import Polaroid from './Polaroid';
import { AppMode, FeatureShape, HandState, PhotoData } from '../types';
import { getPhotoSlotsForShape } from '../utils/geometry';

interface Props {
  mode: AppMode;
  featureShape: FeatureShape;
  handStateRef: React.MutableRefObject<HandState>;
  photos: PhotoData[];
  focusId: string | null;
  params: any;
}

const Scene: React.FC<Props> = ({ mode, featureShape, handStateRef, photos, focusId, params }) => {
  const groupRef = useRef<THREE.Group>(null);
  const cursorRef = useRef<THREE.Mesh>(null);
  const cursorLightRef = useRef<THREE.PointLight>(null);
  
  // Calculate photo slots for the current shape
  const photoSlots = useMemo(() => {
    return getPhotoSlotsForShape(8, featureShape);
  }, [featureShape]);

  // Smooth interaction logic
  useFrame((state, delta) => {
    const hand = handStateRef.current;
    
    if (groupRef.current) {
      // Rotate entire scene based on hand X/Y
      // If hand is not active, slow rotation
      const targetRotX = hand.active ? hand.y * 0.5 : 0;
      const targetRotY = hand.active ? hand.x * 0.5 : state.clock.elapsedTime * 0.05;
      
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, delta * 2);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, delta * 2);
    }

    // Camera movement logic
    const targetPos = new THREE.Vector3(0, 0, 18); // Default slightly further out
    const targetLookAt = new THREE.Vector3(0, 0, 0);

    if (mode === AppMode.FOCUS && focusId) {
       const photoIndex = photos.findIndex(p => p.id === focusId);
       if (photoIndex !== -1) {
         // Zoom in closer for the smaller polaroid size
         targetPos.set(0, 0, 8.5); 
       }
    }

    state.camera.position.lerp(targetPos, delta * 1.5);
    state.camera.lookAt(targetLookAt);

    // Update Cursor (Pinch Feedback)
    if (cursorRef.current && cursorLightRef.current) {
        if (hand.active) {
            // Map -1..1 to frustum visible range (roughly -8..8 for Z=18 distance roughly)
            // But since cursor is part of camera view essentially, let's put it at fixed Z relative to camera or inside world
            // Since camera moves, easier to put cursor in world space but following "screen" coordinates
            // Simple approach: Map hand x/y to X/Y at Z=10
            
            const visibleWidth = 12;
            const visibleHeight = 8;
            
            const targetX = hand.pinchX * visibleWidth;
            const targetY = hand.pinchY * visibleHeight;
            const targetZ = 12; // In front of everything

            // Lerp cursor for smoothness
            cursorRef.current.position.x = THREE.MathUtils.lerp(cursorRef.current.position.x, targetX, delta * 15);
            cursorRef.current.position.y = THREE.MathUtils.lerp(cursorRef.current.position.y, targetY, delta * 15);
            cursorRef.current.position.z = targetZ;

            // Visual State
            const targetScale = hand.isPinching ? 1.5 : 0.5;
            cursorRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10);
            
            // Intensity
            const targetIntensity = hand.isPinching ? 2.0 : 0.5;
            (cursorRef.current.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(
                (cursorRef.current.material as THREE.MeshBasicMaterial).opacity, 
                0.8, 
                delta * 5
            );
            cursorLightRef.current.intensity = targetIntensity;
            
            // Color shift on pinch
            const mat = cursorRef.current.material as THREE.MeshBasicMaterial;
            if (hand.isPinching) mat.color.setHex(0xFFFFFF); // White hot
            else mat.color.setHex(0xD4AF37); // Gold idle

        } else {
            // Hide if inactive
            cursorRef.current.scale.setScalar(0);
        }
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 18]} fov={45} />
      <ambientLight intensity={0.2} color="#004030" />
      <spotLight 
        position={[10, 20, 10]} 
        angle={0.4} 
        penumbra={1} 
        intensity={3} 
        color="#D4AF37" 
        castShadow 
      />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#064e3b" />

      {/* Dramatic Room Environment for Reflections */}
      <Environment preset="city" background={false} />

      {/* Hand Feedback Cursor */}
      <mesh ref={cursorRef} position={[0,0,10]}>
         <sphereGeometry args={[0.15, 16, 16]} />
         <meshBasicMaterial color="#D4AF37" transparent opacity={0} depthTest={false} />
         <pointLight ref={cursorLightRef} distance={5} decay={2} color="#D4AF37" />
      </mesh>

      <group ref={groupRef}>
        {/* The fine "gold dust" structure - Optimized count */}
        <MagicParticles 
          mode={mode} 
          shape={featureShape} 
          count={8000} 
          params={params}
        />
        
        {/* The larger ornaments */}
        <StructureOrnaments 
           mode={mode}
           shape={featureShape}
           count={250}
           params={params}
        />
        
        {photos.map((photo, index) => {
           // Calculate Target Position based on Mode
           let targetPos = new THREE.Vector3();
           let targetRot = new THREE.Vector3();
           
           if (mode === AppMode.FEATURE) {
             // Hang on the shape
             const slot = photoSlots[index % photoSlots.length];
             targetPos.copy(slot);
             // Look at center-ish but slightly randomized
             targetRot.set(0, -Math.atan2(slot.z, slot.x) + Math.PI/2, 0); // Face outwards from center
           } else if (mode === AppMode.SCATTER) {
             // Use original random position from creation
             targetPos.copy(photo.position);
             targetRot.copy(photo.rotation);
             // Add some scatter expansion
             targetPos.multiplyScalar(1.5);
           } else if (mode === AppMode.FOCUS) {
             if (focusId === photo.id) {
               // Center screen, close to camera
               targetPos.set(0, 0, 6); 
               targetRot.set(0, 0, 0);
             } else {
               // Push others back
               targetPos.copy(photo.position).multiplyScalar(2).add(new THREE.Vector3(0,0,-10));
               targetRot.copy(photo.rotation);
             }
           }

           return (
             <Polaroid 
               key={photo.id}
               url={photo.url}
               targetPosition={targetPos}
               targetRotation={targetRot}
               isFocused={mode === AppMode.FOCUS && focusId === photo.id}
             />
           );
        })}
      </group>

      <EffectComposer enableNormalPass={false}>
        <Bloom 
          luminanceThreshold={0.3} 
          mipmapBlur 
          intensity={params.bloomStrength || 1.5} 
          radius={0.4}
          levels={9}
        />
        <Noise opacity={0.05} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </>
  );
};

export default Scene;