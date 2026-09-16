export async function submitTranslation(payload) {
  const response = await fetch("/api/translations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Không thể gửi yêu cầu dịch.");
  }

  return result;
}
