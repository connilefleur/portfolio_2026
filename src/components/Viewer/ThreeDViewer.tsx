import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

interface ThreeDViewerProps {
  src: string;
  description?: string;
}

function Model({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  const modelRef = useRef<THREE.Group>(null);
  
  // Center the model at origin
  useEffect(() => {
    if (modelRef.current) {
      const box = new THREE.Box3();
      box.setFromObject(modelRef.current);
      
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        
        // Center the model at origin
        modelRef.current.position.x = -center.x;
        modelRef.current.position.y = -center.y;
        modelRef.current.position.z = -center.z;
      }
    }
  }, [scene]);
  
  return (
    <group ref={modelRef}>
      <primitive object={scene} />
    </group>
  );
}

function FrameModel({ margin = 0.05, onFramed }: { margin?: number; onFramed?: (distance: number) => void }) {
  const { camera, scene } = useThree();
  
  useEffect(() => {
    // Wait a bit for the model to load and be centered
    const frameModel = () => {
      // Find the model group in the scene
      let modelGroup: THREE.Object3D | null = null;
      scene.traverse((child) => {
        if (child instanceof THREE.Group && child.children.length > 0) {
          modelGroup = child;
        }
      });
      
      if (!modelGroup) return;
      
      // Calculate bounding box of the model
      const box = new THREE.Box3();
      box.setFromObject(modelGroup);
      
      if (!box.isEmpty() && camera instanceof THREE.PerspectiveCamera) {
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Calculate the largest dimension (width or height) to ensure full visibility
        const frameSize = Math.max(size.x, size.y);
        
        // Calculate distance needed to fit the model with margin
        // Formula: distance = (frameSize / 2) / tan(fov / 2)
        const fovRad = (camera.fov * Math.PI) / 180;
        const distance = (frameSize / 2) / Math.tan(fovRad / 2);
        const distanceWithMargin = distance * (1 + margin);
        
        // Double the distance to make model appear half the size
        const finalDistance = distanceWithMargin * 2;
        
        // Position camera in front of the model (positive Z)
        // Camera looks at the center from the front
        camera.position.set(center.x, center.y, center.z + finalDistance);
        camera.lookAt(center);
        
        // Notify parent component of the distance for zoom limits
        if (onFramed) {
          onFramed(finalDistance);
        }
      }
    };
    
    // Try immediately and after a delay to ensure model is loaded
    frameModel();
    const timeout = setTimeout(frameModel, 300);
    
    return () => clearTimeout(timeout);
  }, [scene, camera, margin, onFramed]);
  
  return null;
}

function Controls({ fitDistance }: { fitDistance?: number }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  
  // Set zoom limits based on fitted distance
  useEffect(() => {
    if (controlsRef.current && fitDistance) {
      controlsRef.current.minDistance = fitDistance * 0.3; // Can zoom in to 30%
      controlsRef.current.maxDistance = fitDistance * 2.5; // Can zoom out to 250%
    }
  }, [fitDistance]);
  
  // Update controls every frame for smooth damping
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });
  
  return (
    <OrbitControls
      ref={controlsRef}
      // Rotation settings - smooth and free
      enableRotate={true}
      enableDamping={true}
      dampingFactor={0.05} // Smooth damping for rotation (lower = smoother)
      rotateSpeed={0.8} // Rotation sensitivity
      
      // Zoom settings - smooth with limits to prevent overshooting
      enableZoom={true}
      zoomSpeed={0.8} // Smooth zoom speed
      
      // Panning disabled
      enablePan={false}
      
      // Auto-rotate disabled (user controls rotation)
      autoRotate={false}
      
      // Touch support - OrbitControls handles this automatically
      // One finger drag = rotate, pinch = zoom
    />
  );
}

function SceneContent({ src }: { src: string }) {
  const [fitDistance, setFitDistance] = useState<number | undefined>(undefined);
  
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Model src={src} />
        <FrameModel margin={0.05} onFramed={setFitDistance} />
      </Suspense>
      <Environment preset="studio" />
      <Controls fitDistance={fitDistance} />
    </>
  );
}

export function ThreeDViewer({ src, description }: ThreeDViewerProps) {
  return (
    <div className="viewer-content three-viewer-fullscreen">
      <Canvas 
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <SceneContent src={src} />
        </Suspense>
      </Canvas>
      
      <p className="viewer-nav">
        Drag to rotate • Scroll/Pinch to zoom
      </p>
      
      {description && <p className="viewer-description">{description}</p>}
    </div>
  );
}
