"use strict";

let backgroundjs = async function () {
    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: "view-mode",
            title: "ぐるぐるイメージビュー",
            contexts: ["image"],
        });
    });

    let openViewer = async function () {
        // 画像URLをlocalに保存(ビューアに渡す用)
        let text = await (await fetch("viewer.html")).text();
        await chrome.storage.local.set({ viewerText: text });

        var tabs = await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        });

        console.log("tabs[0] : %o", tabs[0]);
        if (tabs[0].url.startsWith("http") || tabs[0].url.startsWith("file")) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["scripting.js"],
            });
        } else {
            chrome.tabs.create({ url: "viewer_new.html" });
        }
        return;
    };

    let makeImgData = async function (href) {
        await chrome.storage.local.set({ url: href });
        await chrome.storage.local.set({ dataURL: "" });

        // 画像blobフェッチできたらreaderに渡してdataURLにして
        // localに保存してビューア立ち上げて終了。
        // CORSエラーで無理ならビューア立ち上げて終了。

        var opt = {
            method: "GET",
            body: null,
        };
        let blob, res;
        try {
            console.log("fetch ", href);
            res = await fetch(href, opt);
        } catch (e) {
            console.log("CORSエラー");
            return;
        }

        console.log("response status code : ", res.status);
        // レスポンスがOK以外だったら終了
        if (res.status !== 200) return;

        blob = await res.blob();

        // blobをdataURLに変換
        const reader = new FileReader();

        reader.readAsDataURL(blob);
        await new Promise((resolve) =>
            reader.addEventListener("load", async (event) => {
                try {
                    await chrome.storage.local.set({
                        dataURL: event.target.result,
                    });
                } catch (err) {
                    console.log(
                        "データ保存に失敗した恐れがあります。(5MB超のデータ)"
                    );
                    await chrome.storage.local.set({ dataURL: "" });
                    return resolve();
                }

                console.log("画像dataURL作成成功");
                return resolve();
            })
        );

        return;
    };

    ////////////////////////////////////////////////////////////////////////////////
    // 右クリックメニュー　クリック時イベント
    ////////////////////////////////////////////////////////////////////////////////
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        console.log("%o", info);
        if (info.menuItemId === "view-mode") {
            await makeImgData(info.srcUrl);
            await openViewer();
            return;
        }
    });

    chrome.action.onClicked.addListener(async (tab) => {
        await openViewer();
    });
};

backgroundjs();
