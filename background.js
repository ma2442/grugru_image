"use strict";

let backgroundjs = async function () {
    let debug = false;
    let dlog = function (...args) {
        if (debug) console.log(...args);
    };

    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: "view-mode",
            title: "ぐるぐるイメージビュー",
            contexts: ["image"],
        });
    });

    // ビューアー画面を現ページに重ねて開くか新規タブで開くかする
    let openViewer = async function () {
        let text = await (await fetch("viewer.html")).text();
        await chrome.storage.local.set({ viewerText: text });

        var tabs = await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        });

        dlog("tabs[0] : %o", tabs[0]);
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

    // 画像データを取得してdataURLとして保存する
    // できなければ 画像URLのみ保存する
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
            dlog("fetch ", href);
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

        let AddEventListenerPromise = (target, type) => {
            return new Promise((resolve) => {
                let listener = (event) => {
                    dlog({ event });
                    resolve(event);
                };
                target.addEventListener(type, listener);
            });
        };

        let event = await AddEventListenerPromise(reader, "load");

        try {
            await chrome.storage.local.set({ dataURL: event.target.result });
        } catch (err) {
            console.log("データ保存に失敗した恐れがあります。(5MB超のデータ)");
            await chrome.storage.local.set({ dataURL: "" });
            return;
        }

        console.log("画像dataURL作成成功");
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
