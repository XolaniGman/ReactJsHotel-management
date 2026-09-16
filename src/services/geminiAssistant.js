const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = 'gemini-3.6-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

export const DASHBOARD_SECTIONS = [
  { path: '/Guest/Dashboard', label: 'Overview', about: 'Your stay status, room folio balance, today’s bookings and quick actions.' },
  { path: '/Reservations/Create', label: 'My Stays & Bookings', about: 'Book a new room stay.' },
  { path: '/Restaurant/Reserve', label: 'Dining & Lounges', about: 'Reserve a restaurant table.' },
  { path: '/Amenities/Request', label: 'Spa & Wellness', about: 'Request spa treatments or resort amenities.' },
  { path: '/Housekeeping/RequestRoomCleaning', label: 'Housekeeping', about: 'Request room cleaning or fresh supplies.' },
  { path: '/Fleet/Service', label: 'Shuttle & Valet', about: 'Book an airport shuttle or valet trip.' },
  { path: '/Maintenance/Request', label: 'Maintenance', about: 'Report a maintenance issue in your room.' },
  { path: '/LostItems/Services', label: 'Lost & Found', about: 'Report or search for a lost item.' },
  { path: '/Fleet/Vehicles', label: 'Rent a Car', about: 'Browse and rent a vehicle from the fleet.' },
  { path: '/Fleet/MyTrips', label: 'My Trips', about: 'Track your car rentals and shuttle trips.' },
  { path: '/Fleet/Collection', label: 'Fetch the Car', about: 'Pick up a car you have rented.' },
  { path: '/Fleet/Incident/Report', label: 'Report Incident', about: 'Report an incident with a rented vehicle.' },
];

function buildSystemInstruction() {
  const menu = DASHBOARD_SECTIONS.map((s) => `- ${s.label} (${s.path}): ${s.about}`).join('\n');
  return `You are the voice concierge assistant embedded in the guest dashboard of a hotel called "Winds Hotel".
You help the signed-in guest understand and navigate the dashboard by voice.

Sections available in this app (label, path, description):
${menu}

Rules:
- Keep spoken replies short and conversational — 1 to 3 sentences, no markdown, no bullet lists.
- If the guest asks to go/open/navigate to a section, or asks "where is X", set "navigateTo" to the matching path from the list above and mention in "speak" that you're taking them there.
- Only use paths from the list above for "navigateTo". If nothing matches, set "navigateTo" to null.
- If the guest asks a general question you can't answer from the section list (e.g. hotel policies, real-time facts), answer briefly and helpfully anyway, and set "navigateTo" to null.
- Always respond with strict JSON only, matching this shape: {"speak": string, "navigateTo": string|null}`;
}

export async function askDashboardAssistant(userText, history = []) {
  if (!API_KEY) {
    return { speak: "The voice assistant isn't configured yet — ask the developer to set up the Gemini API key.", navigateTo: null };
  }

  const contents = [
    ...history.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    })),
    { role: 'user', parts: [{ text: userText }] },
  ];

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { role: 'system', parts: [{ text: buildSystemInstruction() }] },
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini request failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';

  try {
    const parsed = JSON.parse(raw);
    const navigateTo = DASHBOARD_SECTIONS.some((s) => s.path === parsed.navigateTo) ? parsed.navigateTo : null;
    return { speak: String(parsed.speak || '').trim() || "I'm not sure how to help with that.", navigateTo };
  } catch {
    return { speak: raw.trim() || "I'm not sure how to help with that.", navigateTo: null };
  }
}
