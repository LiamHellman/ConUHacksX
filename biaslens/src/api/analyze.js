const API_URL = import.meta.env.PROD 
  ? "https://factify-api.onrender.com" 
  : "http://localhost:5174";

export async function analyzeText(text, settings = {}) {
  const res = await fetch(`${API_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, settings }),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
