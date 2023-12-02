chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "view-mode",
        title: "ぐるぐるイメージビュー",
        contexts: ["image"],
    });
});

var qs = {};
var name;

////////////////////////////////////////////////////////////////////////////////
// 右クリックメニュー　クリック時イベント
////////////////////////////////////////////////////////////////////////////////
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("%o", info);
    if (info.menuItemId === "view-mode") {
        var href = info.srcUrl;

        // 画像URLをlocalに保存(ビューアに渡す用)
        await chrome.storage.local.set({ url: href });

        // 画像blobフェッチできたらreaderに渡してdataURLにして
        // localに保存してビューア立ち上げて終了。
        // CORSエラーで無理ならビューア立ち上げて終了。

        var opt = {
            method: "GET",
            body: null,
        };
        let blob, response;
        try {
            response = await fetch(href, opt);
        } catch (e) {
            console.log("CORSエラー");
            chrome.tabs.create({ url: "viewer.html" });
            await chrome.storage.local.set({ dataURL: "" });
            return;
        }
        blob = await response.blob();

        // blobをdataURLに変換
        const reader = new FileReader();
        let dataURL;

        reader.onload = async (e) => {
            try {
                await chrome.storage.local.set({ dataURL: e.target.result });
            } catch (e) {
                console.log(
                    "データ保存に失敗した恐れがあります。(5MB超のデータ)"
                );
                chrome.storage.local.set({ dataURL: "" });
            }
            chrome.tabs.create({ url: "viewer.html" });
        };

        reader.readAsDataURL(blob);
        console.log("画像dtaURL作成成功");

        return;
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: "viewer.html" });
});
