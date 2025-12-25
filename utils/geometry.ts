import * as THREE from 'three';
import { FeatureShape } from '../types';

export const getRandomPosition = (scale: number = 10) => {
  return new THREE.Vector3(
    (Math.random() - 0.5) * scale,
    (Math.random() - 0.5) * scale,
    (Math.random() - 0.5) * scale
  );
};

// Helper to get random point in a box
const getPointInBox = (center: THREE.Vector3, size: THREE.Vector3) => {
  return new THREE.Vector3(
    center.x + (Math.random() - 0.5) * size.x,
    center.y + (Math.random() - 0.5) * size.y,
    center.z + (Math.random() - 0.5) * size.z
  );
};

// Helper to get random point in a cylinder
const getPointInCylinder = (center: THREE.Vector3, height: number, radius: number, vertical: boolean = true) => {
  const theta = Math.random() * 2 * Math.PI;
  const r = Math.sqrt(Math.random()) * radius;
  
  if (vertical) {
    return new THREE.Vector3(
      center.x + r * Math.cos(theta),
      center.y + (Math.random() - 0.5) * height,
      center.z + r * Math.sin(theta)
    );
  } else {
    // Oriented along Z for body mostly
    return new THREE.Vector3(
      center.x + r * Math.cos(theta),
      center.y + r * Math.sin(theta),
      center.z + (Math.random() - 0.5) * height
    );
  }
};

export const getShapePositions = (count: number, shape: FeatureShape, spread: number = 1.0): Float32Array => {
  const positions = new Float32Array(count * 3);
  const vec = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    switch (shape) {
      case FeatureShape.TREE:
        // Spiral Tree Skeleton
        // t goes from 0 (bottom) to 1 (top)
        const t = i / count; 
        const tMod = t; 
        
        const spiralLoops = 8;
        const height = -6 + tMod * 12; // -6 to 6
        const maxRadius = 5.0;
        
        // Cone shape taper
        const coneRadius = maxRadius * (1 - tMod);
        const radius = Math.max(0.1, coneRadius); 
        
        // Spiral angle
        const angle = tMod * Math.PI * 2 * spiralLoops;
        
        // Spread logic:
        // If spread is high (particles), we add volume around the wire.
        // If spread is low (ornaments), they stick close to the wire.
        const thickness = spread * (2.0 * (1 - tMod) + 0.5);
        
        const rOffset = (Math.random() - 0.5) * thickness;
        const hOffset = (Math.random() - 0.5) * thickness;
        const aOffset = (Math.random() - 0.5) * (spread * 0.5); // Spread along the arc

        vec.set(
          (radius + rOffset) * Math.cos(angle + aOffset),
          height + hOffset,
          (radius + rOffset) * Math.sin(angle + aOffset)
        );
        break;

      case FeatureShape.SOCK:
        const tSock = Math.random();
        const thicknessSock = 1.2 * spread;
        if (tSock < 0.6) {
          // Leg
          vec.set(
            (Math.random() - 0.5) * thicknessSock,
            (Math.random() * 6) - 1,
            (Math.random() - 0.5) * thicknessSock
          );
        } else {
          // Foot
          vec.set(
            (Math.random() * 3.5) + 0.5,
            -2 + (Math.random() - 0.5) * thicknessSock,
            (Math.random() - 0.5) * thicknessSock
          );
        }
        break;

      case FeatureShape.ELK:
        const part = Math.random();
        const elkSpread = spread * 0.6;
        
        if (part < 0.4) {
          // Body
          vec.copy(getPointInBox(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2.5, 3, 4.5)));
          vec.x += (Math.random()-0.5)*elkSpread;
          vec.y += (Math.random()-0.5)*elkSpread;
          vec.z += (Math.random()-0.5)*elkSpread;
        } else if (part < 0.6) {
          // Legs
          const legIdx = Math.floor(Math.random() * 4);
          const xSign = legIdx % 2 === 0 ? 1 : -1;
          const zSign = legIdx < 2 ? 1 : -1;
          vec.copy(getPointInCylinder(
            new THREE.Vector3(xSign * 1.2, -3, zSign * 1.8), 
            3.5, 
            0.4 + elkSpread * 0.2
          ));
        } else if (part < 0.75) {
          // Neck/Head
          if (Math.random() > 0.4) {
             const nt = Math.random();
             vec.set(
                (Math.random()-0.5) * elkSpread,
                1.5 + nt * 2.5,
                2.2 + nt * 1.5
             );
          } else {
             vec.copy(getPointInBox(new THREE.Vector3(0, 4.5, 4.5), new THREE.Vector3(1.2, 1.5, 2.5)));
          }
        } else {
          // Antlers
          const side = Math.random() > 0.5 ? 1 : -1;
          const at = Math.random(); 
          const ax = side * (0.5 + at * 2.5);
          const ay = 5.5 + at * 3 + Math.sin(at * 10) * 0.5;
          const az = 4.0 - at * 1.5;
          vec.set(
            ax + (Math.random() - 0.5) * 0.3,
            ay + (Math.random() - 0.5) * 0.3,
            az + (Math.random() - 0.5) * 0.3
          );
        }
        break;
        
      case FeatureShape.SANTA:
      default:
        const sPart = Math.random();
        if (sPart < 0.25) {
           // Hat
           const h = Math.random();
           const hatR = 1.5 * (1 - h);
           const hatAngle = Math.random() * Math.PI * 2;
           const localX = hatR * Math.cos(hatAngle);
           const localY = h * 3;
           const localZ = hatR * Math.sin(hatAngle);
           vec.set(localX, localY + 3.8, localZ - 0.5);
           // Rotate Hat
           const rotZ = -0.2;
           const rx = vec.x;
           const ry = vec.y * Math.cos(rotZ) - vec.z * Math.sin(rotZ);
           const rz = vec.y * Math.sin(rotZ) + vec.z * Math.cos(rotZ);
           vec.set(rx, ry, rz);
        } else if (sPart < 0.45) {
           // Face
           const u = Math.random();
           const v = Math.random();
           const theta = 2 * Math.PI * u;
           const phi = Math.acos(2 * v - 1);
           const r = 1.6;
           vec.set(
             r * Math.sin(phi) * Math.cos(theta),
             r * Math.sin(phi) * Math.sin(theta) + 2.5,
             r * Math.cos(phi) + 0.5
           );
        } else if (sPart < 0.6) {
           // Beard
           vec.copy(getPointInBox(new THREE.Vector3(0, 1.2, 1.2), new THREE.Vector3(2.5, 2.0, 1.5)));
        } else {
           // Body
           const u = Math.random();
           const v = Math.random();
           const theta = 2 * Math.PI * u;
           const phi = Math.acos(2 * v - 1);
           const r = 3.5;
           vec.set(
             r * Math.sin(phi) * Math.cos(theta),
             r * Math.sin(phi) * Math.sin(theta) - 1.5,
             r * Math.cos(phi)
           );
        }
        break;
    }
    positions[i * 3] = vec.x;
    positions[i * 3 + 1] = vec.y;
    positions[i * 3 + 2] = vec.z;
  }
  return positions;
};

// Calculate specific hanging spots for photos so they look like ornaments
export const getPhotoSlotsForShape = (count: number, shape: FeatureShape): THREE.Vector3[] => {
  const slots: THREE.Vector3[] = [];
  
  if (shape === FeatureShape.TREE) {
    for (let i = 0; i < count; i++) {
      // Distribute along the spiral
      // We start a bit up (0.2) and end before the very tip (0.9)
      const t = 0.2 + (i / count) * 0.7; 
      
      const spiralLoops = 8;
      const height = -6 + t * 12;
      const maxRadius = 5.0;
      const radius = maxRadius * (1 - t) + 0.8; // Push out slightly so photo hangs on outside
      const angle = t * Math.PI * 2 * spiralLoops + (i * Math.PI / 2); // Add offset to separate from wire slightly
      
      slots.push(new THREE.Vector3(
        radius * Math.cos(angle),
        height,
        radius * Math.sin(angle)
      ));
    }
  } else {
    // For other shapes, just random orbit
    for (let i = 0; i < count; i++) {
        const vec = getRandomPosition(8);
        slots.push(vec);
    }
  }
  return slots;
};