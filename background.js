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

        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ["scripting.js"],
        });
    };

    ////////////////////////////////////////////////////////////////////////////////
    // 右クリックメニュー　クリック時イベント
    ////////////////////////////////////////////////////////////////////////////////
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        console.log("%o", info);
        if (info.menuItemId === "view-mode") {
            var href = info.srcUrl;
            await chrome.storage.local.set({ url: href });
            openViewer();
            return;
        }
    });

    chrome.action.onClicked.addListener((tab) => {
        openViewer();
    });
};

backgroundjs();
