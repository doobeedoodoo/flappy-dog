import { useState, useEffect, useRef, useCallback } from "react";

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 520;
const GRAVITY = 0.45;
const JUMP_FORCE = -8;
const PIPE_WIDTH = 52;
const PIPE_GAP = 150;
const PIPE_SPEED = 2.8;
const PIPE_INTERVAL = 1600; // ms

const DOG_X = 80;
const DOG_SIZE = 36;

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawDog(ctx, x, y, vy, frame) {
  const bobY = Math.sin(frame * 0.15) * 1.5;
  const tilt = Math.max(-25, Math.min(25, vy * 2.5));
  ctx.save();
  ctx.translate(x + DOG_SIZE / 2, y + DOG_SIZE / 2 + bobY);
  ctx.rotate((tilt * Math.PI) / 180);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.ellipse(0, DOG_SIZE / 2 + 4, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.fillStyle = "#F5A623";
  ctx.beginPath();
  const tailWag = Math.sin(frame * 0.25) * 8;
  ctx.moveTo(-DOG_SIZE / 2 + 2, 4);
  ctx.quadraticCurveTo(-DOG_SIZE / 2 - 12, -2 + tailWag, -DOG_SIZE / 2 - 6, -12 + tailWag);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#F5A623";
  ctx.stroke();

  // Body
  ctx.fillStyle = "#F5C842";
  drawRoundedRect(ctx, -DOG_SIZE / 2 + 2, -DOG_SIZE / 2 + 8, DOG_SIZE - 4, DOG_SIZE - 10, 10);
  ctx.fill();

  // Belly
  ctx.fillStyle = "#FDE68A";
  drawRoundedRect(ctx, -6, 0, 14, 10, 5);
  ctx.fill();

  // Head
  ctx.fillStyle = "#F5C842";
  drawRoundedRect(ctx, -DOG_SIZE / 2 + 4, -DOG_SIZE / 2, DOG_SIZE - 8, DOG_SIZE / 2 + 4, 10);
  ctx.fill();

  // Ear left
  ctx.fillStyle = "#D4920A";
  ctx.beginPath();
  ctx.ellipse(-DOG_SIZE / 2 + 5, -DOG_SIZE / 2 + 4, 7, 10, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Ear right
  ctx.beginPath();
  ctx.ellipse(DOG_SIZE / 2 - 5, -DOG_SIZE / 2 + 4, 7, 10, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(-6, -DOG_SIZE / 2 + 10, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(6, -DOG_SIZE / 2 + 10, 4, 0, Math.PI * 2);
  ctx.fill();

  // Eye shines
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(-5, -DOG_SIZE / 2 + 8, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7, -DOG_SIZE / 2 + 8, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.ellipse(0, -DOG_SIZE / 2 + 18, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth smile
  ctx.strokeStyle = "#1a1a2e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -DOG_SIZE / 2 + 21, 4, 0, Math.PI);
  ctx.stroke();

  // Legs
  const legSwing = Math.sin(frame * 0.3) * 5;
  ctx.fillStyle = "#D4920A";
  // Front legs
  drawRoundedRect(ctx, -10, DOG_SIZE / 2 - 10, 8, 14, 4);
  ctx.fill();
  drawRoundedRect(ctx, 2, DOG_SIZE / 2 - 10, 8, 14, 4);
  ctx.fill();

  ctx.restore();
}

function drawPipe(ctx, pipe) {
  const grad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
  grad.addColorStop(0, "#3ecf4a");
  grad.addColorStop(0.4, "#5de066");
  grad.addColorStop(1, "#2aaa35");

  // Bottom pipe
  const bottomY = pipe.gapY + PIPE_GAP / 2;
  ctx.fillStyle = grad;
  drawRoundedRect(ctx, pipe.x, bottomY, PIPE_WIDTH, CANVAS_HEIGHT - bottomY, 6);
  ctx.fill();
  // Cap
  ctx.fillStyle = "#2aaa35";
  drawRoundedRect(ctx, pipe.x - 4, bottomY, PIPE_WIDTH + 8, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#5de066";
  ctx.fillRect(pipe.x - 2, bottomY + 2, 12, 18);

  // Top pipe
  const topBottom = pipe.gapY - PIPE_GAP / 2;
  ctx.fillStyle = grad;
  drawRoundedRect(ctx, pipe.x, 0, PIPE_WIDTH, topBottom, 6);
  ctx.fill();
  // Cap
  ctx.fillStyle = "#2aaa35";
  drawRoundedRect(ctx, pipe.x - 4, topBottom - 22, PIPE_WIDTH + 8, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#5de066";
  ctx.fillRect(pipe.x - 2, topBottom - 20, 12, 18);
}

function drawBackground(ctx, bgOffset) {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  sky.addColorStop(0, "#87CEEB");
  sky.addColorStop(0.7, "#B0E2FF");
  sky.addColorStop(1, "#C8EDA0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Clouds
  const clouds = [
    { x: 60, y: 60, s: 1 },
    { x: 200, y: 40, s: 0.7 },
    { x: 340, y: 80, s: 0.9 },
    { x: 420, y: 50, s: 0.6 },
  ];
  clouds.forEach((c) => {
    const cx = ((c.x - bgOffset * 0.3) % (CANVAS_WIDTH + 120)) - 60;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(cx, c.y, 22 * c.s, 0, Math.PI * 2);
    ctx.arc(cx + 20 * c.s, c.y - 10 * c.s, 16 * c.s, 0, Math.PI * 2);
    ctx.arc(cx + 38 * c.s, c.y, 20 * c.s, 0, Math.PI * 2);
    ctx.fill();
  });

  // Ground
  ctx.fillStyle = "#7bc142";
  ctx.fillRect(0, CANVAS_HEIGHT - 40, CANVAS_WIDTH, 40);
  ctx.fillStyle = "#5a9e2f";
  ctx.fillRect(0, CANVAS_HEIGHT - 40, CANVAS_WIDTH, 8);

  // Ground pattern
  for (let i = 0; i < 10; i++) {
    const gx = ((i * 52 - bgOffset * 2) % (CANVAS_WIDTH + 52)) - 52;
    ctx.fillStyle = "#6ab535";
    ctx.fillRect(gx, CANVAS_HEIGHT - 38, 30, 6);
  }
}

export default function FlappyDog() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    dogY: CANVAS_HEIGHT / 2,
    dogVY: 0,
    pipes: [],
    score: 0,
    gameState: "idle", // idle, playing, dead
    frame: 0,
    bgOffset: 0,
    lastPipeTime: 0,
    deathY: 0,
  });
  const animRef = useRef(null);
  const [displayState, setDisplayState] = useState("idle");
  const [displayScore, setDisplayScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState === "idle") {
      s.gameState = "playing";
      s.dogVY = JUMP_FORCE;
      s.lastPipeTime = performance.now();
      setDisplayState("playing");
    } else if (s.gameState === "playing") {
      s.dogVY = JUMP_FORCE;
    } else if (s.gameState === "dead") {
      // Reset
      s.dogY = CANVAS_HEIGHT / 2;
      s.dogVY = 0;
      s.pipes = [];
      s.score = 0;
      s.frame = 0;
      s.bgOffset = 0;
      s.gameState = "idle";
      setDisplayState("idle");
      setDisplayScore(0);
    }
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [jump]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let lastTime = 0;

    function loop(now) {
      animRef.current = requestAnimationFrame(loop);
      const dt = now - lastTime;
      lastTime = now;

      const s = stateRef.current;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (s.gameState === "playing") {
        s.frame++;
        s.bgOffset += PIPE_SPEED;

        // Physics
        s.dogVY += GRAVITY;
        s.dogY += s.dogVY;

        // Spawn pipes
        if (now - s.lastPipeTime > PIPE_INTERVAL) {
          const minGapY = 120;
          const maxGapY = CANVAS_HEIGHT - 120 - 40;
          s.pipes.push({
            x: CANVAS_WIDTH + 10,
            gapY: minGapY + Math.random() * (maxGapY - minGapY),
            passed: false,
          });
          s.lastPipeTime = now;
        }

        // Move pipes
        s.pipes.forEach((p) => (p.x -= PIPE_SPEED));
        s.pipes = s.pipes.filter((p) => p.x > -PIPE_WIDTH - 20);

        // Score
        s.pipes.forEach((p) => {
          if (!p.passed && p.x + PIPE_WIDTH < DOG_X) {
            p.passed = true;
            s.score++;
            setDisplayScore(s.score);
          }
        });

        // Collision
        const dogLeft = DOG_X - 2;
        const dogRight = DOG_X + DOG_SIZE - 6;
        const dogTop = s.dogY + 4;
        const dogBottom = s.dogY + DOG_SIZE - 4;

        // Ground / ceiling
        if (s.dogY + DOG_SIZE > CANVAS_HEIGHT - 40 || s.dogY < 0) {
          s.gameState = "dead";
          s.deathY = s.dogY;
          setDisplayState("dead");
          setBestScore((prev) => Math.max(prev, s.score));
          return;
        }

        for (const p of s.pipes) {
          if (dogRight > p.x && dogLeft < p.x + PIPE_WIDTH) {
            const topBottom = p.gapY - PIPE_GAP / 2;
            const bottomY = p.gapY + PIPE_GAP / 2;
            if (dogTop < topBottom || dogBottom > bottomY) {
              s.gameState = "dead";
              s.deathY = s.dogY;
              setDisplayState("dead");
              setBestScore((prev) => Math.max(prev, s.score));
              return;
            }
          }
        }
      } else if (s.gameState === "idle") {
        // Float animation
        s.dogY = CANVAS_HEIGHT / 2 - 20 + Math.sin(Date.now() * 0.002) * 8;
        s.frame++;
        s.bgOffset += 0.5;
      }

      // Draw
      drawBackground(ctx, s.bgOffset);
      s.pipes.forEach((p) => drawPipe(ctx, p));
      drawDog(ctx, DOG_X - DOG_SIZE / 2, s.dogY, s.dogVY, s.frame);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Fredoka One', 'Comic Sans MS', cursive",
        userSelect: "none",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
        .game-title {
          font-family: 'Fredoka One', cursive;
          font-size: 2.4rem;
          color: #FFD700;
          text-shadow: 3px 3px 0 #b8860b, 0 0 20px rgba(255,215,0,0.4);
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        .score-display {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Fredoka One', cursive;
          font-size: 2.2rem;
          color: white;
          text-shadow: 2px 2px 0 rgba(0,0,0,0.5);
          pointer-events: none;
        }
        .overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          pointer-events: none;
        }
        .overlay-box {
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(6px);
          border-radius: 20px;
          padding: 24px 36px;
          text-align: center;
          border: 2px solid rgba(255,255,255,0.15);
        }
        .overlay-title {
          font-family: 'Fredoka One', cursive;
          font-size: 1.8rem;
          color: #FFD700;
          margin-bottom: 6px;
        }
        .overlay-sub {
          font-family: 'Fredoka One', cursive;
          font-size: 1rem;
          color: rgba(255,255,255,0.8);
        }
        .tap-hint {
          font-family: 'Fredoka One', cursive;
          font-size: 1.1rem;
          color: #aef;
          animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        canvas { display: block; border-radius: 16px; }
      `}</style>

      <div className="game-title">🐶 Flappy Dog</div>

      <div
        style={{ position: "relative", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
        onClick={jump}
      >
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

        {displayState === "playing" && (
          <div className="score-display">{displayScore}</div>
        )}

        {displayState === "idle" && (
          <div className="overlay">
            <div className="overlay-box">
              <div className="overlay-title">Ready to Fly? 🐾</div>
              <div className="overlay-sub" style={{ marginBottom: 10 }}>
                Help the dog dodge the pipes!
              </div>
              <div className="tap-hint">Press SPACE or Tap to Start</div>
            </div>
          </div>
        )}

        {displayState === "dead" && (
          <div className="overlay">
            <div className="overlay-box">
              <div className="overlay-title">💥 Woof!</div>
              <div style={{ fontFamily: "'Fredoka One', cursive", color: "white", fontSize: "1.2rem", marginBottom: 4 }}>
                Score: {displayScore}
              </div>
              <div style={{ fontFamily: "'Fredoka One', cursive", color: "#FFD700", fontSize: "1rem", marginBottom: 12 }}>
                Best: {bestScore}
              </div>
              <div className="tap-hint">Press SPACE or Tap to Retry</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", fontFamily: "sans-serif" }}>
        Space / Tap to flap &nbsp;•&nbsp; Don't hit the pipes!
      </div>
    </div>
  );
}