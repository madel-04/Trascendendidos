import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';

interface PongCanvasProps {
  isMultiplayer?: boolean;
  side?: 'left' | 'right';
  roomId?: string;
  onMatchEnded?: (winner: 'left' | 'right') => void;
  settings?: { targetScore: number; difficulty: string };
  localControlMode?: 'keyboard' | 'mouse';
}

export interface PongCanvasHandle {
  pause: () => void;
  resume: () => void;
}

const PongCanvas = forwardRef<PongCanvasHandle, PongCanvasProps>(function PongCanvas(
  { isMultiplayer, side, roomId, onMatchEnded, settings, localControlMode = 'keyboard' },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useImperativeHandle(ref, () => ({
    pause: () => engineRef.current?.pause(),
    resume: () => engineRef.current?.resume(),
  }), []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = 800;
    canvas.height = 600;

    engineRef.current = new GameEngine(canvas, isMultiplayer, side, roomId, onMatchEnded, settings, localControlMode);
    engineRef.current.start();

    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, [isMultiplayer, side, roomId, onMatchEnded, settings, localControlMode]);

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
});

export default PongCanvas;
