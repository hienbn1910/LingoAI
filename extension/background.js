chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "translate",
      title: "Dịch với LingoAI",
      contexts: ["selection"],
    });
  });
});

function openPanel(windowId) {
  const fallback = () =>
    chrome.windows.create({
      url: chrome.runtime.getURL(`panel.html?owner=${windowId}`),
      type: "popup",
      width: 440,
      height: 760,
    });

  // Mở ngay trong thao tác người dùng.
  // Không await thao tác lưu dữ liệu trước khi mở.
  if (chrome.sidePanel?.open) {
    chrome.sidePanel.open({ windowId }).catch(fallback);
  } else {
    fallback();
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "translate" || !tab) return;

  const text = info.selectionText || "";

  chrome.storage.session
    .set({
      ["selection:" + tab.windowId]: {
        id: crypto.randomUUID(),
        text: text.length <= 5000 ? text : "",
        error: text.length > 5000 ? "Hãy chọn tối đa 5.000 ký tự." : "",
      },
    })
    .catch(console.error);

  openPanel(tab.windowId);
});

chrome.action.onClicked.addListener((tab) => {
  openPanel(tab.windowId);
});

chrome.windows.onRemoved.addListener((id) => {
  chrome.storage.session.remove("selection:" + id).catch(console.error);
});
