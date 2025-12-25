import React, { useEffect, useRef, useState } from 'react';
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
  
  // Throttling refs
  const lastPredictionTime = useRef<number>(0);
  const PREDICTION_INTERVAL = 100; // ms (approx 10 FPS)

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

    console.info = (...args: any[]) => {
      if (shouldSuppress(args)) return;
      originalConsoleInfo.apply(console, args);
    };

    console.log = (...args: any[]) => {
      if (shouldSuppress(args)) return;
      originalConsoleLog.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      if (shouldSuppress(args)) return;
      originalConsoleWarn.apply(console, args);
    };

    console.error = (...args: any[]) => {
      if (shouldSuppress(args)) return;
      originalConsoleError.apply(console, args);
    };

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
        console.warn("MediaPipe initialization warning (likely harmless fallback):", error);
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
      // Restore original console methods
      console.info = originalConsoleInfo;
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !enabled) return;

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

  const predict = () => {
    const now = Date.now();
    
    // Throttle prediction
    if (now - lastPredictionTime.current >= PREDICTION_INTERVAL) {
      if (recognizerRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const results = recognizerRef.current.recognizeForVideo(videoRef.current, now);

          let x = 0;
          let y = 0;
          let isPinching = false;
          let gesture = 'None';
          let active = false;

          if (results.gestures.length > 0 && results.landmarks.length > 0) {
            active = true;
            const landmarks = results.landmarks[0];
            
            // Map 0..1 to -1..1 range, inverted X for mirror effect
            x = (landmarks[0].x - 0.5) * -2; 
            y = (landmarks[0].y - 0.5) * -2;

            const topGesture = results.gestures[0][0];
            gesture = topGesture.categoryName; 

            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const distance = Math.sqrt(
              Math.pow(thumbTip.x - indexTip.x, 2) + 
              Math.pow(thumbTip.y - indexTip.y, 2)
            );
            
            // Threshold for Pinch
            if (distance < 0.1) {
              isPinching = true;
            }
          }

          onHandUpdate({ x, y, isPinching, gesture, active });
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