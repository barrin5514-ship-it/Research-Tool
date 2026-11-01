// Sends an analyzed post to CoachLab's server-to-server import endpoint.
// The import token stays server-side and is only sent in a request header.
const DISCIPLINES = [
  { names: ['boxing'], value: 'Boxing' },
  { names: ['muay thai', 'muay', 'thai boxing', 'kickboxing'], value: 'Muay Thai' },
  { names: ['bjj', 'brazilian jiu', 'jiu jitsu', 'jiu-jitsu', 'jits'], value: 'Brazilian Jiu-Jitsu' },
  { names: ['wrestling', 'wrestle'], value: 'Wrestling' },
  { names: ['mma', 'mixed martial'], value: 'MMA' },
  { names: ['fitness', 'training', 'workout', 'personal training', 'strength', 'conditioning'], value: 'Personal Training' }
];
const TECHNIQUES = ['jab', 'cross', 'hook', 'uppercut', 'footwork', 'slip', 'parry', 'roundhouse', 'teep', 'clinch', 'knee', 'elbow', 'double leg', 'single leg', 'sprawl', 'pummel', 'breakfall', 'shrimp', 'bridge', 'guard pass', 'knee cut', 'half guard', 'kimura', 'armbar', 'triangle', 'squat', 'lunge', 'deadlift', 'push up', 'pull up', 'plank', 'row', 'balance', 'mobility'];

// Picks the best CoachLab discipline from the post text.
export function disciplineOf(text) {
  const lower = String(text || '').toLowerCase();
  for (const { names, value } of DISCIPLINES) if (names.some(name => lower.includes(name))) return value;
  return 'MMA';
}

// Returns only technique names that actually appear in the post text.
export function techniquesOf(text) {
  const lower = String(text || '').toLowerCase();
  return [...new Set(TECHNIQUES.filter(term => lower.includes(term)))].slice(0, 20).join(', ');
}

// One HTTP call to CoachLab's import endpoint. The token is never logged or echoed.
export async function sendToCoachLab({ post, baseUrl, token, fetcher = fetch }) {
  if (!baseUrl || !token) throw Error('CoachLab is not configured on this server');
  const body = {
    title: post.title,
    url: post.url,
    summary: post.summary,
    transcript: post.transcript || '',
    discipline: post.discipline || disciplineOf([post.summary, post.transcript, post.title].join(' ')),
    drills: post.drills || techniquesOf([post.summary, post.transcript].join(' '))
  };
  // Naming the coach account lets CoachLab pick the right owner without a
  // database id or a Render environment change.
  const ownerEmail = String(process.env.COACHLAB_IMPORT_OWNER_EMAIL || '').trim();
  if (ownerEmail) body.ownerEmail = ownerEmail;
  const response = await fetcher(`${String(baseUrl).replace(/\/+$/, '')}/api/import/research-post`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-coachlab-import-token': token },
    body: JSON.stringify(body)
  });
  let result = {};
  try { result = await response.json(); } catch {}
  if (!response.ok) throw Error(typeof result.error === 'string' && result.error ? result.error : 'CoachLab could not receive the post');
  return { duplicate: Boolean(result.duplicate) };
}
