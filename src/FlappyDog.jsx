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
const DOG_SIZE = 48;

const NEON_COLORS = ["#00ffff", "#ff00ff", "#ffff00", "#00ff88", "#ff6600", "#aa44ff"];

function drawDog(ctx, img, x, y, vy, frame, dead = false) {
  if (!img) return;
  const bobY = dead ? 0 : Math.sin(frame * 0.15) * 1.5;
  const tilt = dead ? 180 : Math.max(-25, Math.min(25, vy * 2.5));
  const r = DOG_SIZE / 2;
  ctx.save();
  ctx.translate(x + r, y + r + bobY);
  ctx.rotate((tilt * Math.PI) / 180);
  // Circular clip so the photo looks clean
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, -r, -r, DOG_SIZE, DOG_SIZE);
  ctx.restore();
}

function drawPipe(ctx, pipe, h) {
  const color = pipe.color || "#00ffff";
  const topBottom = pipe.gapY - PIPE_GAP / 2;
  const bottomY = pipe.gapY + PIPE_GAP / 2;

  [[0, topBottom], [bottomY, h - bottomY]].forEach(([y, height]) => {
    if (height <= 0) return;

    // Dark translucent body
    ctx.fillStyle = "rgba(0, 0, 20, 0.75)";
    ctx.fillRect(pipe.x, y, PIPE_WIDTH, height);

    // Tinted inner fill matching the neon color
    ctx.fillStyle = color + "18";
    ctx.fillRect(pipe.x, y, PIPE_WIDTH, height);

    // Outer glowing border
    ctx.shadowBlur = 24;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(pipe.x + 1, y + 0.5, PIPE_WIDTH - 2, height - 1);

    // Second inner stroke for extra intensity
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pipe.x + 5, y + 4, PIPE_WIDTH - 10, height - 8);

    // Bright vertical center stripe
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.fillStyle = color + "66";
    ctx.fillRect(pipe.x + PIPE_WIDTH / 2 - 2, y, 4, height);

    ctx.shadowBlur = 0;
  });
}

function drawBackground(ctx, bgOffset, w, h) {
  // Deep space base gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#01020f");
  sky.addColorStop(0.5, "#04091e");
  sky.addColorStop(1, "#080612");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Nebula clouds — large soft radial blobs
  const nebulas = [
    { bx: w * 0.2,  y: h * 0.28, r: 200, color: [90, 0, 160] },
    { bx: w * 0.68, y: h * 0.18, r: 220, color: [0, 50, 160] },
    { bx: w * 0.5,  y: h * 0.65, r: 170, color: [140, 0, 90] },
  ];
  nebulas.forEach(({ bx, y, r, color }) => {
    const nx = ((bx - bgOffset * 0.05) % (w + r * 2) + w + r * 2) % (w + r * 2) - r;
    const grad = ctx.createRadialGradient(nx, y, 0, nx, y, r);
    grad.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},0.18)`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(nx - r, y - r, r * 2, r * 2);
  });

  // Stars — layer 1: distant, barely drifting
  for (let i = 0; i < 120; i++) {
    const bx = (i * 137.508) % w;
    const by = (i * 73.117) % (h * 0.92);
    const x = ((bx - bgOffset * 0.02) % w + w) % w;
    const alpha = 0.25 + (i % 6) * 0.08;
    const size = 0.4 + (i % 3) * 0.35;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, by, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stars — layer 2: mid-distance
  for (let i = 0; i < 55; i++) {
    const bx = (i * 251.317) % w;
    const by = (i * 113.691) % (h * 0.9);
    const x = ((bx - bgOffset * 0.07) % w + w) % w;
    const alpha = 0.45 + (i % 4) * 0.12;
    const size = 0.7 + (i % 3) * 0.55;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, by, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Colored stars (blue-white and amber)
  for (let i = 0; i < 18; i++) {
    const bx = (i * 319.7) % w;
    const by = (i * 89.3) % (h * 0.88);
    const x = ((bx - bgOffset * 0.04) % w + w) % w;
    const palette = ["rgba(160,200,255,0.8)", "rgba(255,210,160,0.8)", "rgba(200,160,255,0.8)"];
    ctx.fillStyle = palette[i % 3];
    ctx.beginPath();
    ctx.arc(x, by, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant planet (drifts very slowly)
  const planetX = ((w * 0.8 - bgOffset * 0.015) % (w + 200) + w + 200) % (w + 200) - 100;
  const planetY = h * 0.17;
  const pr = 52;
  const pGrad = ctx.createRadialGradient(planetX - pr * 0.3, planetY - pr * 0.3, 3, planetX, planetY, pr);
  pGrad.addColorStop(0, "#7a9fff");
  pGrad.addColorStop(0.45, "#3a52cc");
  pGrad.addColorStop(1, "#07103a");
  ctx.fillStyle = pGrad;
  ctx.beginPath();
  ctx.arc(planetX, planetY, pr, 0, Math.PI * 2);
  ctx.fill();
  // Planet ring
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "#88aaff";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(planetX, planetY, pr * 1.75, pr * 0.32, -0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Floor — dark asteroid/station deck
  ctx.fillStyle = "#060610";
  ctx.fillRect(0, h - 40, w, 40);

  // Glowing floor edge
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#5555ff";
  ctx.fillStyle = "#6677ff";
  ctx.fillRect(0, h - 42, w, 3);
  ctx.shadowBlur = 0;

  // Scrolling grid on floor
  ctx.strokeStyle = "rgba(55, 55, 130, 0.45)";
  ctx.lineWidth = 1;
  const gridStep = 44;
  const gridOff = bgOffset * 2 % gridStep;
  for (let gx = -gridOff; gx < w; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gx, h - 40);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
}

// === Audio synthesis ===
// Happy C-major melody: C E G E | C D E G | F A G E | D F E C
const MELODY = [
  523.25, 659.25, 783.99, 659.25,
  523.25, 587.33, 659.25, 783.99,
  698.46, 880.00, 783.99, 659.25,
  587.33, 698.46, 659.25, 523.25,
];
const NOTE_STEP = 0.15; // seconds between note starts
const NOTE_DUR  = 0.12; // seconds each note sounds

function startMusic(audio) {
  const { ctx } = audio;
  if (!ctx) return;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.16;
  masterGain.connect(ctx.destination);
  audio.musicGain = masterGain;

  let nextNoteTime = ctx.currentTime + 0.05;
  let noteIdx = 0;

  function schedule() {
    while (nextNoteTime < ctx.currentTime + 0.6) {
      const freq = MELODY[noteIdx % MELODY.length];
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.45, nextNoteTime);
      g.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + NOTE_DUR);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(nextNoteTime);
      osc.stop(nextNoteTime + NOTE_DUR);
      nextNoteTime += NOTE_STEP;
      noteIdx++;
    }
  }
  schedule();
  audio.musicIntervalId = setInterval(schedule, 200);
}

function stopMusic(audio) {
  clearInterval(audio.musicIntervalId);
  audio.musicIntervalId = null;
  if (audio.musicGain && audio.ctx) {
    const g = audio.musicGain;
    g.gain.setValueAtTime(g.gain.value, audio.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.25);
    setTimeout(() => { try { g.disconnect(); } catch (_) {} }, 300);
    audio.musicGain = null;
  }
}

function playBark(ctx) {
  if (!ctx) return;
  const t = ctx.currentTime;
  // Pitched "woof" sweep
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.14);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.28, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
  // Short noise attack
  const bufSize = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = 900;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.4;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(t);
}

function playGameOver(ctx) {
  if (!ctx) return;
  const t = ctx.currentTime;
  // Three descending tones: A4 → F4 → D4
  [440, 349, 294].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq * 1.15, t + i * 0.22);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.75, t + i * 0.22 + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t + i * 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.22 + 0.2);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t + i * 0.22);
    osc.stop(t + i * 0.22 + 0.25);
  });
}

export default function FlappyDog() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    dogY: CANVAS_HEIGHT / 2,
    dogVY: 0,
    pipes: [],
    score: 0,
    gameState: "idle",
    frame: 0,
    bgOffset: 0,
    lastPipeTime: 0,
    deathY: 0,
  });
  const animRef = useRef(null);
  const dogImgRef = useRef(null);
  const audioRef = useRef({ ctx: null, musicGain: null, musicIntervalId: null });
  const [displayState, setDisplayState] = useState("idle");
  const [displayScore, setDisplayScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  const jump = useCallback(() => {
    const s = stateRef.current;
    const audio = audioRef.current;
    // Init AudioContext on first gesture (browser autoplay policy)
    if (!audio.ctx) {
      audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audio.ctx.state === "suspended") audio.ctx.resume();
    playBark(audio.ctx);
    if (s.gameState === "idle") {
      s.gameState = "playing";
      s.dogVY = JUMP_FORCE;
      s.lastPipeTime = performance.now();
      setDisplayState("playing");
      startMusic(audio);
    } else if (s.gameState === "playing") {
      s.dogVY = JUMP_FORCE;
    } else if (s.gameState === "dead") {
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
    const img = new Image();
    img.src = "/mimiw.png";
    img.onload = () => { dogImgRef.current = img; };
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

    function loop(now) {
      animRef.current = requestAnimationFrame(loop);

      const s = stateRef.current;
      const w = CANVAS_WIDTH;
      const h = CANVAS_HEIGHT;
      ctx.clearRect(0, 0, w, h);

      if (s.gameState === "playing") {
        s.frame++;
        s.bgOffset += PIPE_SPEED;

        // Physics
        s.dogVY += GRAVITY;
        s.dogY += s.dogVY;

        // Spawn pipes
        if (now - s.lastPipeTime > PIPE_INTERVAL) {
          const minGapY = 120;
          const maxGapY = h - 120 - 40;
          s.pipes.push({
            x: w + 10,
            gapY: minGapY + Math.random() * (maxGapY - minGapY),
            passed: false,
            color: NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)],
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

        // Collision boxes
        const dogLeft = DOG_X - 2;
        const dogRight = DOG_X + DOG_SIZE - 6;
        const dogTop = s.dogY + 4;
        const dogBottom = s.dogY + DOG_SIZE - 4;

        // Ground / ceiling
        if (s.dogY + DOG_SIZE > h - 40 || s.dogY < 0) {
          s.gameState = "dead";
          s.deathY = s.dogY;
          setDisplayState("dead");
          setBestScore((prev) => Math.max(prev, s.score));
          stopMusic(audioRef.current);
          playGameOver(audioRef.current.ctx);
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
              stopMusic(audioRef.current);
              playGameOver(audioRef.current.ctx);
              return;
            }
          }
        }
      } else if (s.gameState === "idle") {
        s.dogY = h / 2 - 20 + Math.sin(Date.now() * 0.002) * 8;
        s.frame++;
        s.bgOffset += 0.5;
      }

      // Draw
      drawBackground(ctx, s.bgOffset, w, h);
      s.pipes.forEach((p) => drawPipe(ctx, p, h));
      drawDog(ctx, dogImgRef.current, DOG_X - DOG_SIZE / 2, s.dogY, s.dogVY, s.frame, s.gameState === "dead");
    }

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      stopMusic(audioRef.current);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #01020f 0%, #04091e 50%, #080612 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Fredoka One', 'Comic Sans MS', cursive",
        userSelect: "none",
      }}
    >
      <div
        style={{ position: "relative", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(80,80,255,0.15)" }}
        onClick={jump}
      >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
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
        canvas { display: block; }
      `}</style>

      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

      {displayState === "playing" && (
        <div className="score-display">{displayScore}</div>
      )}

      {displayState === "idle" && (
        <div className="overlay">
          <div className="overlay-box">
            <img
              src="/mimiw.png"
              alt="Mimiw"
              style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", marginBottom: 10, border: "3px solid #FFD700", boxShadow: "0 0 16px rgba(255,215,0,0.5)" }}
            />
            <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: "2.4rem", color: "#FFD700", textShadow: "3px 3px 0 #b8860b, 0 0 20px rgba(255,215,0,0.4)", marginBottom: 8, letterSpacing: 1 }}>
              Flappy Mimiw
            </div>
            <div className="overlay-title" style={{ fontSize: "1.4rem" }}>Ready to Fly? 🐾</div>
            <div className="overlay-sub" style={{ marginBottom: 10 }}>
              Help Marley dodge the obstacles!
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
    </div>
  );
}
