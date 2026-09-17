export async function submitTranslation(payload, { signal } = {}) {
  const response = await fetch("/api/translations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Không thể thực hiện dịch.");
  }

  return result;
}
