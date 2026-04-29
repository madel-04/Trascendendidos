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
      className="game-canvas"
    />
  );
});

export default PongCanvas;
