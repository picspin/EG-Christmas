import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import * as THREE from 'three';
import GUI from 'lil-gui';

import Scene from './components/Scene';
import UIOverlay from './components/UIOverlay';
import HandController from './components/HandController';
import { AppMode, FeatureShape, HandState, PhotoData, MAX_PHOTOS } from './types';
import { getRandomPosition } from './utils/geometry';

// Default Luxury Christmas Images for immediate demo
const DEFAULT_PHOTOS: PhotoData[] = [
    { id: '1', url: 'https://images.unsplash.com/photo-1543258103-a62bdc069871?auto=format&fit=crop&w=400&q=80', position: getRandomPosition(15), rotation: new THREE.Vector3() },
    { id: '2', url: 'https://images.unsplash.com/photo-1512474932049-78ac69ede12c?auto=format&fit=crop&w=400&q=80', position: getRandomPosition(15), rotation: new THREE.Vector3() },
    { id: '3', url: 'https://images.unsplash.com/photo-1576919228236-a097c32a5cd4?auto=format&fit=crop&w=400&q=80', position: getRandomPosition(15), rotation: new THREE.Vector3() },
    { id: '4', url: 'https://images.unsplash.com/photo-1482517967863-00e15c9b44be?auto=format&fit=crop&w=400&q=80', position: getRandomPosition(15), rotation: new THREE.Vector3() },
];

const App: React.FC = () => {
  // State
  const [mode, setMode] = useState<AppMode>(AppMode.FEATURE);
  const [featureShape, setFeatureShape] = useState<FeatureShape>(FeatureShape.TREE);
  const [photos, setPhotos] = useState<PhotoData[]>(DEFAULT_PHOTOS); // Init with defaults
  const [focusId, setFocusId] = useState<string | null>(null);
  const [handControlEnabled, setHandControlEnabled] = useState(true);
  const [gestureDisplay, setGestureDisplay] = useState('None');
  
  // Mutable Ref for high-frequency hand data to avoid React render loop
  const handStateRef = useRef<HandState>({
    x: 0,
    y: 0,
    pinchX: 0,
    pinchY: 0,
    isPinching: false,
    gesture: 'None',
    active: false
  });

  // Lil-GUI Params
  const params = useRef({
    color: '#D4AF37',
    metalness: 0.9,
    roughness: 0.2,
    speed: 1.0,
    bloomStrength: 1.5,
    ornamentScale: 1.0,
  });

  // Initialize GUI
  useEffect(() => {
    const gui = new GUI({ title: 'Visuals' });
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '20px';
    gui.domElement.style.right = '20px';
    
    gui.addColor(params.current, 'color').name('Particle Color');
    gui.add(params.current, 'metalness', 0, 1);
    gui.add(params.current, 'roughness', 0, 1);
    gui.add(params.current, 'speed', 0, 5);
    gui.add(params.current, 'bloomStrength', 0, 3).name('Glow');
    gui.add(params.current, 'ornamentScale', 0.1, 3.0).name('Ornament Size');
    
    return () => {
      gui.destroy();
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') {
        setHandControlEnabled(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Hand Update Handler (runs on animation frame from HandController)
  const handleHandUpdate = useCallback((state: HandState) => {
    handStateRef.current = state;
    setGestureDisplay(state.gesture);

    if (!handControlEnabled) return;

    // State Logic based on Gestures
    
    if (state.gesture === 'Closed_Fist') {
      setMode(prev => prev !== AppMode.FEATURE ? AppMode.FEATURE : prev);
      setFocusId(null);
    } else if (state.gesture === 'Open_Palm') {
      setMode(prev => prev !== AppMode.SCATTER ? AppMode.SCATTER : prev);
      setFocusId(null);
    }

    // Pinch Logic for Focus
    if (state.isPinching) {
       // Only trigger focus if we have photos and aren't already focused
       if (mode !== AppMode.FOCUS && photos.length > 0) {
         // Pick a random photo to focus on
         const randomId = photos[Math.floor(Math.random() * photos.length)].id;
         setMode(AppMode.FOCUS);
         setFocusId(randomId);
       }
    }
  }, [handControlEnabled, mode, photos]);

  // Handle Photo Upload
  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos: PhotoData[] = [];
      const files = Array.from(e.target.files);
      
      files.forEach((file) => {
        if (photos.length + newPhotos.length >= MAX_PHOTOS) return;
        const url = URL.createObjectURL(file as Blob);
        
        // Random placement for initial Scatter mode
        const pos = getRandomPosition(15);
        
        newPhotos.push({
          id: Math.random().toString(36).substr(2, 9),
          url,
          position: pos,
          rotation: new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5
          )
        });
      });
      
      setPhotos(prev => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
      
      {/* 3D Scene */}
      <Canvas shadows dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Scene 
            mode={mode} 
            featureShape={featureShape} 
            handStateRef={handStateRef}
            photos={photos}
            focusId={focusId}
            params={params.current}
          />
        </Suspense>
      </Canvas>
      <Loader />

      {/* UI & Overlay */}
      <UIOverlay 
        mode={mode}
        currentShape={featureShape}
        setShape={setFeatureShape}
        onAddPhoto={handleAddPhoto}
        handActive={handControlEnabled && (gestureDisplay !== 'None')}
        gestureName={gestureDisplay}
      />

      {/* Hidden Logic */}
      <HandController 
        onHandUpdate={handleHandUpdate} 
        enabled={handControlEnabled}
      />
    </div>
  );
};

export default App;