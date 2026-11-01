// Holographic "research core" for the dashboard hero. Static SVG plus CSS animation,
// so it stays sharp, needs no WebGL and loads instantly on a laptop.
const SVG_NS = 'http://www.w3.org/2000/svg';

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export const CORE_CENTER = Object.freeze({ x: 180, y: 208 });

export function coreNodes(count = 64, radius = 78, seed = 7) {
  const random = mulberry32(seed);
  const nodes = [];
  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    nodes.push({
      x: Math.round((CORE_CENTER.x + Math.cos(angle) * distance) * 10) / 10,
      y: Math.round((CORE_CENTER.y + Math.sin(angle) * distance) * 10) / 10,
      r: Math.round((1.3 + random() * 2) * 10) / 10,
      tone: index % 9,
    });
  }
  return nodes;
}

export function coreLinks(nodes, maxDistance = 29) {
  const links = [];
  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      const dx = nodes[first].x - nodes[second].x;
      const dy = nodes[first].y - nodes[second].y;
      if (dx * dx + dy * dy <= maxDistance * maxDistance) links.push([first, second]);
    }
  }
  return links;
}

function sparks(count = 20, seed = 21) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const distance = 104 + random() * 66;
    return {
      x: Math.round((CORE_CENTER.x + Math.cos(angle) * distance) * 10) / 10,
      y: Math.round((CORE_CENTER.y + Math.sin(angle) * distance * 0.82) * 10) / 10,
      r: Math.round((0.8 + random() * 1.5) * 10) / 10,
      tone: index % 9,
    };
  });
}

export function coreMarkup() {
  const nodes = coreNodes();
  const links = coreLinks(nodes);
  const parts = [];
  parts.push(
    '<svg class="core-svg" viewBox="0 0 360 440" role="presentation" focusable="false">',
    '<defs>',
    '<radialGradient id="coreFloor" cx="50%" cy="50%" r="50%">',
    '<stop offset="0%" stop-color="#8f6bff" stop-opacity=".55"/><stop offset="55%" stop-color="#4b7dff" stop-opacity=".18"/><stop offset="100%" stop-color="#4b7dff" stop-opacity="0"/>',
    '</radialGradient>',
    '<linearGradient id="coreGlass" x1="0" y1="0" x2="1" y2="0">',
    '<stop offset="0%" stop-color="#9bd6ff" stop-opacity=".16"/><stop offset="18%" stop-color="#9bd6ff" stop-opacity=".03"/><stop offset="82%" stop-color="#9bd6ff" stop-opacity=".03"/><stop offset="100%" stop-color="#9bd6ff" stop-opacity=".16"/>',
    '</linearGradient>',
    '<linearGradient id="coreBeam" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0%" stop-color="#9be9ff" stop-opacity="0"/><stop offset="45%" stop-color="#9be9ff" stop-opacity=".5"/><stop offset="100%" stop-color="#a06bff" stop-opacity="0"/>',
    '</linearGradient>',
    '<radialGradient id="coreSphere" cx="42%" cy="36%" r="70%">',
    '<stop offset="0%" stop-color="#ffffff" stop-opacity=".95"/><stop offset="18%" stop-color="#b8f4ff" stop-opacity=".9"/><stop offset="48%" stop-color="#6f9dff" stop-opacity=".55"/><stop offset="100%" stop-color="#7b3cff" stop-opacity="0"/>',
    '</radialGradient>',
    '<radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">',
    '<stop offset="0%" stop-color="#8fe4ff" stop-opacity=".55"/><stop offset="45%" stop-color="#8a63ff" stop-opacity=".25"/><stop offset="100%" stop-color="#8a63ff" stop-opacity="0"/>',
    '</radialGradient>',
    '</defs>',
    '<ellipse cx="180" cy="398" rx="150" ry="26" fill="url(#coreFloor)"/>',
    '<ellipse cx="180" cy="372" rx="104" ry="16" fill="#070b18" stroke="#5f7dff" stroke-opacity=".35"/>',
    '<ellipse cx="180" cy="381" rx="72" ry="10" fill="none" stroke="#7fe6ff" stroke-opacity=".35"/>',
    '<ellipse cx="180" cy="388" rx="44" ry="6" fill="none" stroke="#b18cff" stroke-opacity=".4"/>',
    '<rect x="80" y="58" width="200" height="300" rx="30" fill="url(#coreGlass)" stroke="#8fbcff" stroke-opacity=".28"/>',
    '<ellipse cx="180" cy="60" rx="102" ry="13" fill="#0a1230" fill-opacity=".55" stroke="#9bd6ff" stroke-opacity=".45"/>',
    '<path d="M92 78 L92 330" stroke="#bfe6ff" stroke-opacity=".28" stroke-width="2"/>',
    '<path d="M268 78 L268 330" stroke="#bfe6ff" stroke-opacity=".16" stroke-width="1"/>',
    '<rect x="166" y="66" width="28" height="290" fill="url(#coreBeam)" opacity=".55"/>',
    '<circle class="core-pulse" cx="180" cy="208" r="152" fill="url(#coreGlow)"/>',
  );

  parts.push('<g class="core-rings">');
  parts.push('<ellipse cx="180" cy="208" rx="142" ry="40" transform="rotate(-18 180 208)" class="core-ring"/>');
  parts.push('<ellipse cx="180" cy="208" rx="126" ry="58" transform="rotate(24 180 208)" class="core-ring is-alt"/>');
  parts.push('<ellipse cx="180" cy="208" rx="92" ry="106" transform="rotate(-8 180 208)" class="core-ring is-vertical"/>');
  parts.push('</g>');

  parts.push('<g class="core-mesh">');
  for (const [first, second] of links) {
    const a = nodes[first];
    const b = nodes[second];
    parts.push(
      '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" class="core-link"/>',
    );
  }
  for (const node of nodes) {
    parts.push('<circle cx="' + node.x + '" cy="' + node.y + '" r="' + node.r + '" class="core-node tone-' + node.tone + '"/>');
  }
  parts.push('<circle cx="180" cy="208" r="52" class="core-inner"/>');
  parts.push('</g>');

  // A holographic brain built from a soft outline and circuit-like folds.
  parts.push('<g class="core-brain">');
  parts.push('<path class="brain-shape" d="M180 146 C166 136 148 138 138 150 C124 146 110 154 108 168 C96 176 96 192 106 200 C100 216 112 230 128 230 C134 244 152 250 168 244 C174 250 186 250 192 244 C208 250 226 244 232 230 C248 230 260 216 254 200 C264 192 264 176 252 168 C250 154 236 146 222 150 C212 138 194 136 180 146 Z"/>');
  parts.push('<path class="brain-fold" d="M138 162 C150 170 164 166 172 156"/>');
  parts.push('<path class="brain-fold" d="M222 162 C210 170 196 166 188 156"/>');
  parts.push('<path class="brain-fold" d="M118 184 C134 192 154 188 166 178"/>');
  parts.push('<path class="brain-fold" d="M242 184 C226 192 206 188 194 178"/>');
  parts.push('<path class="brain-fold" d="M124 206 C140 214 160 210 172 200"/>');
  parts.push('<path class="brain-fold" d="M236 206 C220 214 200 210 188 200"/>');
  parts.push('<path class="brain-fold" d="M136 226 C150 232 164 230 176 222"/>');
  parts.push('<path class="brain-fold" d="M224 226 C210 232 196 230 184 222"/>');
  parts.push('<path class="brain-stem" d="M174 244 C177 256 183 256 186 244"/>');
  parts.push('<path class="brain-fold" d="M180 150 L180 242"/>');
  parts.push('</g>');

  parts.push('<circle cx="180" cy="208" r="118" fill="url(#coreGlow)" opacity=".55" class="core-orb"/>');
  parts.push('<circle cx="180" cy="208" r="104" fill="none" stroke="#c9f3ff" stroke-opacity=".22" stroke-dasharray="1 7" class="core-orb-ring"/>');
  parts.push('<rect x="138" y="128" width="84" height="160" rx="42" fill="none" class="core-scan"/>');

  for (const spark of sparks()) {
    parts.push('<circle cx="' + spark.x + '" cy="' + spark.y + '" r="' + spark.r + '" class="core-spark tone-' + spark.tone + '"/>');
  }
  parts.push('</svg>');
  return parts.join('');
}

export function mountHeroCore({ document }) {
  const host = document.getElementById('hero-core');
  if (!host) return false;
  host.innerHTML = coreMarkup();
  return true;
}
