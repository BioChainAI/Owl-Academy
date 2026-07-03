/**
 * Node Network Background — shared dark backdrop for mage_tower pages.
 * ----------------------------------------------------------------------------
 * Replaces the old per-page flat radial-gradient "glow blob" backgrounds,
 * which were bright and uniform enough to wash out translucent glass panels
 * sitting on top of them. This paints a near-black void with a sparse,
 * slow-drifting node network (dots + connecting lines) in the page's accent
 * color at low opacity — texture without brightness, so panels stay legible.
 *
 * Usage:
 *   <script type="module" src="../scripts/ui/node-network-bg.js"></script>
 *   <script type="module" src="../scripts/ui/node-network-bg.js" data-accent="#00d4ff"></script>
 *
 * data-accent is optional (defaults to Academy gold). Honors
 * prefers-reduced-motion (renders one static frame, no animation loop).
 */

const SCRIPT = document.currentScript;
const accent = SCRIPT?.dataset.accent || "#D4AF37";
const VOID = "#05030a";

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const [AR, AG, AB] = hexToRgb(accent);
const rgba = (a) => `rgba(${AR},${AG},${AB},${a})`;

// Flat void fallback + !important so no bright page-authored gradient can
// flash before the canvas paints (or if canvas/JS fails outright).
const style = document.createElement("style");
style.textContent = `
  body { background: ${VOID} !important; }
  #node-network-bg { position: fixed; inset: 0; width: 100%; height: 100%;
    z-index: -1; pointer-events: none; display: block; }
`;
document.head.appendChild(style);

const canvas = document.createElement("canvas");
canvas.id = "node-network-bg";

function mount() {
  document.body.insertBefore(canvas, document.body.firstChild);
}
if (document.body) mount();
else document.addEventListener("DOMContentLoaded", mount);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ctx = canvas.getContext("2d");
let W, H, DPR, nodes = [];
const LINK_DIST_CSS = 150; // px, before DPR scaling

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = canvas.width = innerWidth * DPR;
  H = canvas.height = innerHeight * DPR;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  const density = Math.round((innerWidth * innerHeight) / 26000);
  const count = Math.min(85, Math.max(22, density));
  nodes = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.1 * DPR,
    vy: (Math.random() - 0.5) * 0.1 * DPR,
    r: (Math.random() * 1.1 + 0.6) * DPR,
  }));
}
window.addEventListener("resize", resize);
resize();

function draw() {
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, W, H);

  // faint upper vignette so the frame isn't perfectly flat
  const g = ctx.createRadialGradient(W / 2, H * 0.12, 0, W / 2, H * 0.12, Math.max(W, H) * 0.75);
  g.addColorStop(0, rgba(0.05));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const linkDist = LINK_DIST_CSS * DPR;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
      const d = Math.hypot(dx, dy);
      if (d < linkDist) {
        ctx.strokeStyle = rgba(0.13 * (1 - d / linkDist));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }
  for (const n of nodes) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(0.5);
    ctx.fill();
  }
}

function frame() {
  for (const n of nodes) {
    n.x += n.vx; n.y += n.vy;
    if (n.x < 0 || n.x > W) n.vx *= -1;
    if (n.y < 0 || n.y > H) n.vy *= -1;
  }
  draw();
  if (!reduceMotion) requestAnimationFrame(frame);
}

if (reduceMotion) draw();
else frame();
