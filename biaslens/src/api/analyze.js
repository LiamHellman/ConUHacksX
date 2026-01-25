// Change 3001 to 5174
export async function analyzeText(text, settings = {}) {
  const res = await fetch("http://localhost:5174/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, settings }),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
