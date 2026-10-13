const $ = (id) => document.getElementById(id);

const names = {
  vi: "Tiếng Việt",
  en: "English",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
};

for (const [code, name] of Object.entries({
  auto: "Tự phát hiện",
  ...names,
})) {
  $("source").add(new Option(name, code));
}

for (const [code, name] of Object.entries(names)) {
  $("target").add(new Option(name, code));
}

let base = "http://127.0.0.1:5001";
let controller;
let generation = 0;

let pair = null;
let context = null;
let history = [];
let selectionId;

function status(text, error = false) {
  $("status").textContent = text;
  $("status").className = error ? "error" : "";
}

function busy(value) {
  const ids = [
    "translate",
    "explain",
    "excerptSource",
    "excerptResult",
    "send",
    "reset",
    "save",
  ];

  for (const id of ids) {
    $(id).disabled = value;
  }

  $("stop").disabled = !value;

  if (!value) {
    $("explain").disabled = !pair;
  }
}

function cancel() {
  generation++;
  controller?.abort();
  controller = null;
  busy(false);
}

function resetChat() {
  context = null;
  history = [];
  $("messages").replaceChildren();
  $("chat").hidden = true;
}

function invalidate() {
  cancel();
  pair = null;

  $("result").value = "";
  $("copy").disabled = true;
  $("explain").disabled = true;

  resetChat();
  status("");
}

function endpoint(value) {
  const url = new URL(value.trim());

  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw Error(
      "Dùng địa chỉ http://127.0.0.1:CỔNG hoặc " +
        "http://localhost:CỔNG, không thêm /api.",
    );
  }

  return url.origin;
}

async function post(path, payload, signal) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    throw Error(data.message || `API lỗi HTTP ${response.status}`);
  }

  return response;
}

function errorText(error) {
  if (error.name === "TimeoutError") {
    return "Yêu cầu quá lâu. Thử đoạn ngắn hơn " + "hoặc kiểm tra Ollama.";
  }

  if (error instanceof TypeError) {
    return (
      "Không kết nối được backend. Kiểm tra cổng, backend, " +
      "quyền truy cập mạng local và cấu hình CORS của server."
    );
  }

  return error.message;
}

async function translate() {
  const text = $("original").value;

  invalidate();

  if (!text.trim() || text.length > 5000) {
    return status("Chọn từ 1 đến 5.000 ký tự.", true);
  }

  const id = generation;

  controller = new AbortController();
  busy(true);
  status("Đang dịch…");

  try {
    const response = await post(
      "/api/translations",
      {
        text,
        sourceLanguage: $("source").value,
        targetLanguage: $("target").value,
      },
      AbortSignal.any([controller.signal, AbortSignal.timeout(150000)]),
    );

    const data = await response.json();

    if (id !== generation) return;

    if (
      data.success === false ||
      typeof data.data?.translatedText !== "string" ||
      !data.data.translatedText.trim()
    ) {
      throw Error(data.message || "API trả về bản dịch không hợp lệ.");
    }

    const result = data.data;

    $("result").value = result.translatedText;

    pair = {
      mode: "pair",
      originalText: text,
      translatedText: result.translatedText,
      sourceLanguage:
        result.detectedLanguage || result.sourceLanguage || $("source").value,
      targetLanguage: $("target").value,
    };

    $("copy").disabled = false;
    status("Đã dịch xong.");
  } catch (error) {
    if (id === generation) {
      status(errorText(error), true);
    }
  } finally {
    if (id === generation) {
      controller = null;
      busy(false);
    }
  }
}

function setContext(next) {
  const bytes = new TextEncoder().encode(JSON.stringify(next)).length;

  if (bytes > 5500) {
    status("Đoạn quá dài theo giới hạn API. Hãy chọn ít hơn.", true);
    return false;
  }

  cancel();

  history = [];
  context = next;

  $("messages").replaceChildren();
  $("chat").hidden = false;

  $("contextNote").textContent =
    next.mode === "pair"
      ? "Đang đối chiếu bản gốc và bản dịch."
      : "Chỉ phân tích đoạn đã chọn; AI không nhận " +
        "toàn bộ trang hoặc cặp gốc–dịch.";

  status("Bạn có thể gửi câu hỏi về nội dung này.");

  return true;
}

function excerpt(field) {
  const element = $(field);

  const text = element.value.slice(
    element.selectionStart,
    element.selectionEnd,
  );

  if (!text.trim() || text.length > 1200) {
    return status(
      "Bôi đen từ 1 đến 1.200 ký tự trong ô tương ứng trước.",
      true,
    );
  }

  setContext({
    mode: "excerpt",
    originalText: field === "original" ? text : "",
    translatedText: field === "result" ? text : "",
    sourceLanguage: pair?.sourceLanguage || $("source").value,
    targetLanguage: $("target").value,
  });
}

function message(role, text) {
  const div = document.createElement("div");

  div.className = "message " + role;

  // Hiển thị dạng text, không chèn HTML từ model.
  div.textContent = text;

  $("messages").append(div);

  return div;
}

async function ask(question) {
  if (!context) {
    return status("Chọn nội dung để hỏi AI trước.", true);
  }

  if (!question.trim() || question.length > 1000) {
    return status("Câu hỏi cần từ 1 đến 1.000 ký tự.", true);
  }

  cancel();

  const id = generation;
  controller = new AbortController();

  busy(true);

  message("user", question);

  const bubble = message("assistant", "Đang trả lời…");

  let answer = "";
  let finished = false;
  let truncated = false;

  status("AI đang trả lời…");

  try {
    const response = await post(
      "/api/explanations/chat",
      {
        context,
        question,
        history: history.slice(-12),
      },
      AbortSignal.any([controller.signal, AbortSignal.timeout(150000)]),
    );

    if (
      !response.body ||
      !response.headers.get("content-type")?.includes("application/x-ndjson")
    ) {
      throw Error("API chat chưa trả đúng định dạng NDJSON.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    const consume = (line) => {
      if (!line.trim()) return;

      const event = JSON.parse(line);

      if (event.type === "error") {
        throw Error(event.message || "AI báo lỗi.");
      }

      if (event.type === "token") {
        if (typeof event.text !== "string") {
          throw Error("Token không hợp lệ.");
        }

        answer += event.text;

        if (answer.length > 24000) {
          throw Error("Câu trả lời quá dài.");
        }

        if (id === generation) {
          bubble.textContent = answer;
        }
      }

      if (event.type === "done") {
        finished = true;
        truncated = Boolean(event.truncated);
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();

        buffer += done
          ? decoder.decode()
          : decoder.decode(value, { stream: true });

        if (buffer.length > 1000000) {
          throw Error("Phản hồi quá lớn.");
        }

        let index;

        while ((index = buffer.indexOf("\n")) >= 0) {
          consume(buffer.slice(0, index));
          buffer = buffer.slice(index + 1);
        }

        if (done) break;
      }

      consume(buffer);
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }

    if (id !== generation) return;

    if (!finished || !answer.trim()) {
      throw Error("Câu trả lời bị ngắt hoặc trống. Hãy thử lại.");
    }

    if (!truncated && answer.length <= 10000) {
      history = [
        ...history,
        {
          role: "user",
          content: question,
        },
        {
          role: "assistant",
          content: answer,
        },
      ].slice(-12);
    }

    status(
      truncated
        ? "Câu trả lời bị cắt do giới hạn model; " +
            "chưa đưa vào lịch sử hội thoại."
        : "Đã trả lời.",
    );
  } catch (error) {
    if (id === generation) {
      bubble.textContent = (answer ? answer + "\n\n" : "") + "[Chưa hoàn tất]";

      status(errorText(error), true);
    }
  } finally {
    if (id === generation) {
      controller = null;
      busy(false);
    }
  }
}

$("translate").onclick = translate;

$("original").oninput = invalidate;

$("source").onchange = invalidate;

$("target").onchange = () => {
  invalidate();

  chrome.storage.local
    .set({
      target: $("target").value,
    })
    .catch((error) => status(error.message, true));
};

$("save").onclick = async () => {
  try {
    const value = endpoint($("base").value);

    await chrome.storage.local.set({
      base: value,
    });

    base = value;

    invalidate();
    status("Đã lưu kết nối.");
  } catch (error) {
    status(error.message, true);
  }
};

$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("result").value);

    status("Đã sao chép.");
  } catch {
    status("Không sao chép được. Hãy chọn nội dung và nhấn Ctrl+C.", true);
  }
};

$("explain").onclick = () => {
  if (!pair) return;

  if (pair.originalText.length > 1200 || pair.translatedText.length > 1200) {
    return status(
      "Nội dung dài. Chọn một đoạn trong ô " + "rồi bấm nút hỏi về đoạn chọn.",
    );
  }

  if (setContext({ ...pair })) {
    ask(
      "Giải thích bản dịch bằng tiếng Việt: ý nghĩa, " +
        "từ ngữ đáng chú ý và điểm có thể dịch khác. " +
        "Không mặc định bản dịch luôn đúng.",
    );
  }
};

$("excerptSource").onclick = () => {
  excerpt("original");
};

$("excerptResult").onclick = () => {
  excerpt("result");
};

$("reset").onclick = () => {
  cancel();

  history = [];

  $("messages").replaceChildren();

  status("Đã xóa cuộc trò chuyện; giữ đoạn đang hỏi.");
};

$("stop").onclick = () => {
  cancel();

  status(
    "Đã dừng. Phần trả lời chưa hoàn tất " + "không được gửi vào lượt sau.",
  );
};

$("form").onsubmit = (event) => {
  event.preventDefault();

  if (!controller) {
    ask($("question").value.trim());
  }
};

window.addEventListener("pagehide", () => {
  controller?.abort();
});

async function init() {
  const settings = await chrome.storage.local.get(["base", "target"]);

  base = endpoint(settings.base || base);

  $("base").value = base;

  $("target").value = Object.hasOwn(names, settings.target)
    ? settings.target
    : "vi";

  const owner = new URLSearchParams(location.search).get("owner");

  const windowId =
    owner === null ? (await chrome.windows.getCurrent()).id : Number(owner);

  const key = "selection:" + windowId;

  const accept = (value) => {
    if (!value || value.id === selectionId) return;

    selectionId = value.id;

    invalidate();

    $("original").value = value.text || "";

    if (value.error) {
      status(value.error, true);
    } else {
      translate();
    }
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes[key]) {
      accept(changes[key].newValue);
    }
  });

  accept((await chrome.storage.session.get(key))[key]);
}

init().catch((error) => {
  status(error.message, true);
});

$("closePanel").onclick = async () => {
  // Dừng yêu cầu dịch hoặc chat đang chạy.
  cancel();

  // Khi LingoAI mở trong cửa sổ popup dự phòng.
  if (new URLSearchParams(location.search).has("owner")) {
    window.close();
    return;
  }

  if (typeof chrome.sidePanel?.close !== "function") {
    status(
      "Trình duyệt chưa hỗ trợ nút đóng này. Hãy dùng nút đóng bảng bên của trình duyệt hoặc cập nhật trình duyệt.",
      true,
    );
    return;
  }

  try {
    const currentWindow = await chrome.windows.getCurrent();

    await chrome.sidePanel.close({
      windowId: currentWindow.id,
    });
  } catch {
    status(
      "Chưa đóng được LingoAI. Hãy dùng nút đóng bảng bên của trình duyệt.",
      true,
    );
  }
};