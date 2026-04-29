import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type Vec2 = {
  x: number;
  y: number;
};

export default function HomeShowcase() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const timeoutRef = React.useRef<number | null>(null);
  const [isLeaving, setIsLeaving] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let lastTime = performance.now();

    const board = { width: 1280, height: 720 };
    const paddle = { width: 18, height: 126, inset: 48 };
    const ballRadius = 10;
    const baseBallSpeed = 388;
    const paddleSpeed = 430;

    const left: Vec2 = { x: paddle.inset, y: board.height / 2 - paddle.height / 2 };
    const right: Vec2 = { x: board.width - paddle.inset - paddle.width, y: board.height / 2 - paddle.height / 2 };
    const ball: Vec2 = { x: board.width / 2, y: board.height / 2 };
    let velocity: Vec2 = { x: baseBallSpeed, y: baseBallSpeed * 0.32 };
    let leftVelocity = 0;
    let rightVelocity = 0;
    let leftBias = 0;
    let rightBias = 0;
    let idleTime = 0;

    const randomBias = () => (Math.random() * 2 - 1) * paddle.height * 0.18;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
    };

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const movePaddleTowards = (currentY: number, targetY: number, dt: number) => {
      const delta = targetY - currentY;
      const maxStep = paddleSpeed * dt;
      const next = Math.abs(delta) <= maxStep ? targetY : currentY + Math.sign(delta) * maxStep;
      return clamp(next, 0, board.height - paddle.height);
    };

    const getPredictedY = (paddleX: number, direction: 1 | -1, bias: number) => {
      if ((direction === 1 && velocity.x <= 0) || (direction === -1 && velocity.x >= 0)) {
        const drift = Math.sin(idleTime * (direction === 1 ? 0.8 : 1.05)) * 56;
        return clamp(board.height / 2 - paddle.height / 2 + drift, 0, board.height - paddle.height);
      }

      const distance = Math.abs(paddleX - ball.x);
      const travelTime = distance / Math.max(Math.abs(velocity.x), 1);
      let projectedY = ball.y + velocity.y * travelTime;
      const minY = 24 + ballRadius;
      const maxY = board.height - 24 - ballRadius;

      while (projectedY < minY || projectedY > maxY) {
        if (projectedY < minY) {
          projectedY = minY + (minY - projectedY);
        } else if (projectedY > maxY) {
          projectedY = maxY - (projectedY - maxY);
        }
      }

      return clamp(projectedY - paddle.height / 2 + bias, 0, board.height - paddle.height);
    };

    const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
      context.beginPath();
      context.moveTo(x + radius, y);
      context.arcTo(x + width, y, x + width, y + height, radius);
      context.arcTo(x + width, y + height, x, y + height, radius);
      context.arcTo(x, y + height, x, y, radius);
      context.arcTo(x, y, x + width, y, radius);
      context.closePath();
    };

    const render = () => {
      const scaleX = canvas.width / board.width;
      const scaleY = canvas.height / board.height;
      context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      context.clearRect(0, 0, board.width, board.height);

      const background = context.createLinearGradient(0, 0, board.width, board.height);
      background.addColorStop(0, "rgba(3, 10, 24, 0.94)");
      background.addColorStop(1, "rgba(18, 5, 19, 0.92)");
      context.fillStyle = background;
      context.fillRect(0, 0, board.width, board.height);

      context.fillStyle = "rgba(0, 240, 255, 0.08)";
      context.beginPath();
      context.arc(board.width * 0.18, board.height * 0.22, 220, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "rgba(255, 0, 60, 0.08)";
      context.beginPath();
      context.arc(board.width * 0.82, board.height * 0.76, 250, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = "rgba(255, 255, 255, 0.18)";
      context.lineWidth = 3;
      context.setLineDash([18, 22]);
      context.beginPath();
      context.moveTo(board.width / 2, 40);
      context.lineTo(board.width / 2, board.height - 40);
      context.stroke();
      context.setLineDash([]);

      context.shadowBlur = 24;
      context.shadowColor = "rgba(0, 240, 255, 0.65)";
      context.fillStyle = "#00f0ff";
      drawRoundedRect(left.x, left.y, paddle.width, paddle.height, 12);
      context.fill();

      context.shadowColor = "rgba(255, 0, 60, 0.65)";
      context.fillStyle = "#ff003c";
      drawRoundedRect(right.x, right.y, paddle.width, paddle.height, 12);
      context.fill();

      context.shadowBlur = 28;
      context.shadowColor = "rgba(255, 255, 255, 0.88)";
      context.fillStyle = "#f8fbff";
      context.beginPath();
      context.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
      context.fill();

      context.shadowBlur = 0;
    };

    const update = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;
      idleTime += dt;

      const leftTarget = getPredictedY(left.x + paddle.width, -1, leftBias);
      const rightTarget = getPredictedY(right.x, 1, rightBias);
      const nextLeftY = movePaddleTowards(left.y, leftTarget, dt);
      const nextRightY = movePaddleTowards(right.y, rightTarget, dt);
      leftVelocity = (nextLeftY - left.y) / Math.max(dt, 0.001);
      rightVelocity = (nextRightY - right.y) / Math.max(dt, 0.001);
      left.y = nextLeftY;
      right.y = nextRightY;

      ball.x += velocity.x * dt;
      ball.y += velocity.y * dt;

      if (ball.y - ballRadius <= 24) {
        ball.y = 24 + ballRadius;
        velocity.y = Math.abs(velocity.y);
      } else if (ball.y + ballRadius >= board.height - 24) {
        ball.y = board.height - 24 - ballRadius;
        velocity.y = -Math.abs(velocity.y);
      }

      const intersectsLeftPaddle =
        ball.x - ballRadius <= left.x + paddle.width &&
        ball.y + ballRadius >= left.y &&
        ball.y - ballRadius <= left.y + paddle.height;
      const intersectsRightPaddle =
        ball.x + ballRadius >= right.x &&
        ball.y + ballRadius >= right.y &&
        ball.y - ballRadius <= right.y + paddle.height;

      if (intersectsLeftPaddle && velocity.x < 0) {
        const offset = (ball.y - (left.y + paddle.height / 2)) / (paddle.height / 2);
        ball.x = left.x + paddle.width + ballRadius;
        velocity.x = Math.abs(baseBallSpeed);
        velocity.y = clamp(
          baseBallSpeed * 0.7 * offset + leftVelocity * 0.18 + leftBias * 0.16,
          -baseBallSpeed * 0.82,
          baseBallSpeed * 0.82
        );
        if (Math.abs(velocity.y) < 90) {
          velocity.y = 90 * (Math.random() > 0.5 ? 1 : -1);
        }
        leftBias = randomBias();
      } else if (intersectsRightPaddle && velocity.x > 0) {
        const offset = (ball.y - (right.y + paddle.height / 2)) / (paddle.height / 2);
        ball.x = right.x - ballRadius;
        velocity.x = -Math.abs(baseBallSpeed);
        velocity.y = clamp(
          baseBallSpeed * 0.7 * offset + rightVelocity * 0.18 + rightBias * 0.16,
          -baseBallSpeed * 0.82,
          baseBallSpeed * 0.82
        );
        if (Math.abs(velocity.y) < 90) {
          velocity.y = 90 * (Math.random() > 0.5 ? 1 : -1);
        }
        rightBias = randomBias();
      }

      if (ball.x < -80) {
        left.y = clamp(ball.y - paddle.height / 2, 0, board.height - paddle.height);
        ball.x = left.x + paddle.width + ballRadius;
        velocity.x = Math.abs(baseBallSpeed);
        velocity.y = clamp(velocity.y * -0.85, -baseBallSpeed * 0.72, baseBallSpeed * 0.72);
        leftBias = randomBias();
      } else if (ball.x > board.width + 80) {
        right.y = clamp(ball.y - paddle.height / 2, 0, board.height - paddle.height);
        ball.x = right.x - ballRadius;
        velocity.x = -Math.abs(baseBallSpeed);
        velocity.y = clamp(velocity.y * -0.85, -baseBallSpeed * 0.72, baseBallSpeed * 0.72);
        rightBias = randomBias();
      }

      render();
      animationFrame = window.requestAnimationFrame(update);
    };

    resize();
    render();
    animationFrame = window.requestAnimationFrame(update);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handlePlay = () => {
    if (isLeaving) return;
    setIsLeaving(true);
    timeoutRef.current = window.setTimeout(() => navigate("/play"), 520);
  };

  return (
    <section className={`home-showcase${isLeaving ? " home-showcase-leaving" : ""}`}>
      <div className="home-showcase-stage">
        <canvas ref={canvasRef} className="home-showcase-canvas" aria-hidden="true" />
        <div className="home-showcase-overlay" />

        <div className="home-showcase-content">
          <div className="home-showcase-kicker">{t("HOME_SHOWCASE_KICKER")}</div>
          <h1 className="home-showcase-title">NEON PONG</h1>
          <p className="home-showcase-copy">{t("HOME_SHOWCASE_COPY")}</p>
          <button className="btn home-showcase-cta" type="button" onClick={handlePlay}>
            {t("PLAY")}
          </button>
        </div>
      </div>
    </section>
  );
}
