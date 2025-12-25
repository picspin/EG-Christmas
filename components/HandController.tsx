import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import { HandState } from '../types';

interface Props {
  onHandUpdate: (state: HandState) => void;
  enabled: boolean;
}

const HandController: React.FC<Props> = ({ onHandUpdate, enabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const requestRef = useRef<number>(0);
  const [loaded, setLoaded] = useState(false);
  
  // Keep latest callback in ref to avoid stale closures in RAF loop
  const onHandUpdateRef = useRef(onHandUpdate);
  useLayoutEffect(() => {
    onHandUpdateRef.current = onHandUpdate;
  }, [onHandUpdate]);

  // Logic & Throttling refs
  const lastPredictionTime = useRef<number>(0);
  const pinchFrameCount = useRef<number>(0);
  const PINCH_THRESHOLD_FRAMES = 5; // Sustain pinch for 5 frames to trigger
  const PREDICTION_INTERVAL = 60; // ms (Increased FPS slightly for smoother cursor)

  useEffect(() => {
    let recognizer: GestureRecognizer | null = null;
    let isActive = true;

    // Patch console methods to suppress internal TF/MediaPipe logs
    const originalConsoleInfo = console.info;
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    const shouldSuppress = (args: any[]) => {
      const msg = args[0];
      return typeof msg === 'string' && (
        msg.includes('TensorFlow Lite XNNPACK') || 
        msg.includes('Created TensorFlow Lite') ||
        msg.includes('XNNPACK delegate')
      );
    };

    const patchConsole = () => {
      console.info = (...args: any[]) => { if (!shouldSuppress(args)) originalConsoleInfo.apply(console, args); };
      console.log = (...args: any[]) => { if (!shouldSuppress(args)) originalConsoleLog.apply(console, args); };
      console.warn = (...args: any[]) => { if (!shouldSuppress(args)) originalConsoleWarn.apply(console, args); };
      console.error = (...args: any[]) => { if (!shouldSuppress(args)) originalConsoleError.apply(console, args); };
    };
    
    patchConsole();

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );
        
        if (!isActive) return;

        recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        if (isActive) {
          recognizerRef.current = recognizer;
          setLoaded(true);
        } else {
          recognizer.close();
        }
      } catch (error) {
        console.warn("MediaPipe initialization warning:", error);
      }
    };

    init();

    return () => {
      isActive = false;
      if (recognizerRef.current) {
        recognizerRef.current.close();
        recognizerRef.current = null;
      }
      setLoaded(false);
      // Restore console
      console.info = originalConsoleInfo;
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    };
  }, []);

  useEffect(() => {
    // If not loaded, or explicitly disabled, do nothing (or clean up)
    if (!loaded) return;
    
    if (!enabled) {
        // If disabled, ensure we stop the loop and video but don't destroy the recognizer
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        cancelAnimationFrame(requestRef.current);
        // Reset state so UI knows hand is gone
        onHandUpdateRef.current({ x: 0, y: 0, pinchX: 0, pinchY: 0, isPinching: false, gesture: 'None', active: false });
        return;
    }

    let stream: MediaStream | null = null;
    let isActive = true;

    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
          } 
        });
        if (videoRef.current && isActive) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
             if (isActive) predict();
          };
          await videoRef.current.play().catch(e => console.warn("Video play failed", e));
        }
      } catch (err) {
        console.error("Webcam error:", err);
      }
    };

    startWebcam();

    return () => {
      isActive = false;
      cancelAnimationFrame(requestRef.current);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadeddata = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, enabled]);

  // Helper: Euclidian distance between two 3D points (or landmarks)
  const getDistance = (p1: any, p2: any) => {
      return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  const predict = () => {
    const now = Date.now();
    
    // Throttle prediction
    if (now - lastPredictionTime.current >= PREDICTION_INTERVAL) {
      if (recognizerRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const results = recognizerRef.current.recognizeForVideo(videoRef.current, now);

          let x = 0;
          let y = 0;
          let pinchX = 0;
          let pinchY = 0;
          let isPinching = false;
          let gesture = 'None';
          let active = false;

          if (results.gestures.length > 0 && results.landmarks.length > 0) {
            active = true;
            const landmarks = results.landmarks[0];
            const wrist = landmarks[0];
            
            // 1. Calculate General Hand Position for Rotation (Palm center approx 0 or 9)
            // Map 0..1 to -1..1 range, inverted X for mirror effect
            x = (landmarks[0].x - 0.5) * -2; 
            y = (landmarks[0].y - 0.5) * -2;

            const topGesture = results.gestures[0][0];
            gesture = topGesture.categoryName; 

            // 2. Robust Pinch Detection Logic
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const middleTip = landmarks[12]; const middleMCP = landmarks[9];
            const ringTip = landmarks[16];   const ringMCP = landmarks[13];
            const pinkyTip = landmarks[20];  const pinkyMCP = landmarks[17];

            // A. Primary Condition: Thumb and Index are close
            const tipDistance = getDistance(thumbTip, indexTip);
            
            // B. Secondary Condition: Other fingers are curled (Tip closer to wrist than MCP is to wrist)
            const isMiddleCurled = getDistance(middleTip, wrist) < getDistance(middleMCP, wrist) * 1.2;
            const isRingCurled = getDistance(ringTip, wrist) < getDistance(ringMCP, wrist) * 1.2;
            const isPinkyCurled = getDistance(pinkyTip, wrist) < getDistance(pinkyMCP, wrist) * 1.2;

            const areOthersCurled = isMiddleCurled && isRingCurled && isPinkyCurled;

            // C. Calculate Pinch Center (screen space for cursor)
            // Scale and Invert X for mirror mode
            pinchX = ((thumbTip.x + indexTip.x) / 2 - 0.5) * -2;
            pinchY = ((thumbTip.y + indexTip.y) / 2 - 0.5) * -2;

            // D. Combine checks
            if (tipDistance < 0.08 && areOthersCurled) {
                pinchFrameCount.current += 1;
            } else {
                pinchFrameCount.current = Math.max(0, pinchFrameCount.current - 2);
            }

            // E. Debounce Trigger
            if (pinchFrameCount.current >= PINCH_THRESHOLD_FRAMES) {
                isPinching = true;
                gesture = 'Pinch'; 
                pinchFrameCount.current = PINCH_THRESHOLD_FRAMES + 2;
            }

          } else {
             pinchFrameCount.current = 0;
          }

          // ALWAYS call the latest ref
          onHandUpdateRef.current({ x, y, pinchX, pinchY, isPinching, gesture, active });
          lastPredictionTime.current = now;
        } catch (e) {
          // Suppress momentary tracking errors
        }
      }
    }

    requestRef.current = requestAnimationFrame(predict);
  };

  return (
    <div className="fixed top-0 left-0 w-32 h-24 opacity-0 pointer-events-none z-0">
      <video 
        ref={videoRef} 
        className="w-full h-full object-cover transform scale-x-[-1]" 
        autoPlay 
        playsInline 
        muted 
        crossOrigin="anonymous"
      />
    </div>
  );
};

export default HandController;