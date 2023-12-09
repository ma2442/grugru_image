"use strict";

let backgroundjs = async function () {
    let debug = false;
    let dlog = function (...args) {
        if (debug) console.log(...args);
    };

    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: "view-mode",
            title: chrome.i18n.getMessage("contextMenusTitle"),
            contexts: ["image"],
        });
    });

    // ビューアー画面を現ページに重ねて開くか新規タブで開くかする
    let openViewer = async function () {
        let text = await (await fetch("viewer.html")).text();
        await chrome.storage.local.set({ viewerText: text });

        let tabs = await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        });

        dlog("tabs[0] : %o", tabs[0]);

        let url = new URL(tabs[0].url);
        if (
            ["http:", "https:", "file:"].includes(url.protocol) &&
            !/chromewebstore.google.com/.test(url.host)
        ) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["scripting.js"],
            });
        } else {
            chrome.tabs.create({ url: "viewer_new.html" });
        }
        return;
    };

    // 画像データを取得してdataURLとして保存する
    // できなければ 画像URLのみ保存する
    let makeImgData = async function (href) {
        //urlがそもそもdataURLなら保存して終了
        if (href.startsWith("data:")) {
            await chrome.storage.local.set({ url: "", dataURL: href });
            return;
        }
        await chrome.storage.local.set({ url: href, dataURL: "" });
        return;
    };

    // 画像の上で右クリックするとコンテキストメニューに"ぐるぐるイメージ"を表示
    // クリックするとビューア起動して画像を表示する
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        dlog("%o", info);
        if (info.menuItemId === "view-mode") {
            await makeImgData(info.srcUrl);
            await openViewer();
            return;
        }
    });

    // 拡張のアイコンクリックしたらビューアを開く
    chrome.action.onClicked.addListener(async (tab) => {
        await openViewer();
    });
};

backgroundjs();
