import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, Environment } from '@react-three/drei';

interface ThreeDViewerProps {
  src: string;
  description?: string;
}

function Model({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

export function ThreeDViewer({ src, description }: ThreeDViewerProps) {
  return (
    <div className="viewer-content" style={{ width: '80vw', height: '70vh' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Suspense fallback={null}>
          <Model src={src} />
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
        />
      </Canvas>
      
      <p className="viewer-nav" style={{ marginTop: '1rem' }}>
        Drag to rotate • Scroll to zoom • Shift+drag to pan
      </p>
      
      {description && <p className="viewer-description">{description}</p>}
    </div>
  );
}
