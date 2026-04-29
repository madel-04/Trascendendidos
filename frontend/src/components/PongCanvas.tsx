import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';

interface PongCanvasProps {
  isMultiplayer?: boolean;
  side?: 'left' | 'right';
  roomId?: string;
  onMatchEnded?: (winner: 'left' | 'right') => void;
  settings?: { targetScore: number; difficulty: string };
  localControlMode?: 'keyboard' | 'mouse';
  localPlayerSide?: 'left' | 'right';
}

export interface PongCanvasHandle {
  pause: () => void;
  resume: () => void;
}

const PongCanvas = forwardRef<PongCanvasHandle, PongCanvasProps>(function PongCanvas(
  { isMultiplayer, side, roomId, onMatchEnded, settings, localControlMode = 'keyboard', localPlayerSide = 'right' },
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
    canvas.width = 1440;
    canvas.height = 900;

    engineRef.current = new GameEngine(canvas, isMultiplayer, side, roomId, onMatchEnded, settings, localControlMode, localPlayerSide);
    engineRef.current.start();

    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, [isMultiplayer, side, roomId, onMatchEnded, settings, localControlMode, localPlayerSide]);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
    />
  );
});

export default PongCanvas;
