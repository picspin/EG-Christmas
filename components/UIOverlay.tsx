import React, { useRef } from 'react';
import { AppMode, FeatureShape } from '../types';

interface Props {
  mode: AppMode;
  currentShape: FeatureShape;
  setShape: (s: FeatureShape) => void;
  onAddPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handActive: boolean;
  gestureName: string;
}

const UIOverlay: React.FC<Props> = ({ 
  mode, 
  currentShape, 
  setShape, 
  onAddPhoto, 
  handActive, 
  gestureName 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shapes = Object.values(FeatureShape);

  // Safely handle display text
  const safeGestureName = gestureName || 'None';
  const isHandActive = !!handActive;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
      
      {/* Header */}
      <div className="w-full flex justify-center mt-4">
        <h1 className="font-display text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold-100 via-gold-500 to-gold-700 drop-shadow-[0_0_15px_rgba(212,175,55,0.8)] tracking-widest text-center animate-pulse">
          Merry Christmas
        </h1>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-6 pointer-events-auto">
        
        {/* Mode Indicator / Gesture Feedback */}
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-emerald-800 text-gold-300 font-serif text-sm">
           <span className={`w-2 h-2 rounded-full ${isHandActive ? 'bg-green-500 animate-pulse' : 'bg-red-900'}`} />
           <span>{isHandActive ? `Hand Detected: ${safeGestureName}` : 'Waiting for Hand...'}</span>
           <span className="mx-2">|</span>
           <span>Mode: {mode}</span>
        </div>

        {/* Shape Selector */}
        <div className={`flex gap-4 transition-opacity duration-500 ${mode === AppMode.FEATURE ? 'opacity-100' : 'opacity-0'}`}>
          {shapes.map((s) => (
            <button
              key={s}
              onClick={() => setShape(s)}
              className={`px-4 py-2 rounded-lg font-serif tracking-wider border transition-all duration-300 ${
                currentShape === s 
                  ? 'bg-gold-500/20 border-gold-500 text-gold-100 shadow-[0_0_15px_rgba(212,175,55,0.4)]' 
                  : 'bg-black/20 border-white/10 text-gray-400 hover:border-gold-500/50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Upload Button */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="group relative px-8 py-3 bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl overflow-hidden transition-all hover:bg-white/10 hover:border-gold-500/50"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <span className="font-serif text-gold-300 text-lg tracking-widest group-hover:text-gold-100 transition-colors">
            ADD MEMORIES
          </span>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          multiple
          onChange={onAddPhoto}
        />

        <div className="text-emerald-800/60 font-mono text-xs mt-2 pb-4">
          PRESS 'H' TO TOGGLE HAND CONTROL
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;