export async function getHealth() {
  const response = await fetch("/api/health");

  if (!response.ok) {
    throw new Error("Backend trả về lỗi.");
  }

  return response.json();
}
