chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "ninja-download",
        title: "ninja download",
        contexts: ["image"],
    });
    chrome.contextMenus.create({
        id: "view-mode",
        title: "ビュー",
        contexts: ["image"],
    });
});

var qs = {};

////////////////////////////////////////////////////////////////////////////////
// 右クリックメニュー　クリック時イベント
////////////////////////////////////////////////////////////////////////////////
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("%o", info);
    if (info.menuItemId === "ninja-download") {
        var href = info.srcUrl;
        var filename = crypto.randomUUID();
        var options = { url: href, filename: String.raw`${filename}` };
        var id = await chrome.downloads.download(options);
        qs[id] = true;

        console.log("download: %o", qs);
        return;
    }
    if (info.menuItemId === "view-mode") {
        var href = info.srcUrl;
        chrome.tabs.create({ url: "viewer.html" });
        await chrome.storage.local.set({ url: href });
        return;
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: "viewer.html" });
});

////////////////////////////////////////////////////////////////////////////////
// ダウンロードキューの状態変化時イベント
// ダウンロード終了時にその履歴を消す
////////////////////////////////////////////////////////////////////////////////
chrome.downloads.onChanged.addListener(async (delta) => {
    if (!qs[delta.id]) return;
    if (!notifyComplete(delta)) return;
    let { filename } = (await chrome.downloads.search({ id: delta.id }))[0];
    console.log("delta %o", delta);
    console.log("erase %o", filename);
    await chrome.downloads.erase({ id: delta.id });
    qs[delta.id] = undefined;
});

var notifyComplete = function (delta) {
    if (delta.state === undefined) return false;
    let { current, previous } = delta.state;
    return current === "complete" && previous === "in_progress";
};
