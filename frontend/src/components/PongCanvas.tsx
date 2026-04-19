import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';

interface PongCanvasProps {
  isMultiplayer?: boolean;
  side?: 'left' | 'right';
  roomId?: string;
}

const PongCanvas: React.FC<PongCanvasProps> = ({ isMultiplayer, side, roomId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize the game engine
    const canvas = canvasRef.current;
    
    // Set explicit size for internal resolution
    canvas.width = 800;
    canvas.height = 600;

    engineRef.current = new GameEngine(canvas, isMultiplayer, side, roomId);
    engineRef.current.start();

    // Clean up on unmount
    return () => {
      engineRef.current?.stop();
    };
  }, [isMultiplayer, side, roomId]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        width: '100%',
        maxWidth: '800px',
        maxHeight: '55vh',
        aspectRatio: '4 / 3',
        background: '#0a0a14', 
        borderRadius: '8px',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    />
  );
};

export default PongCanvas;
