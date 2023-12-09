"use strict";

var main = async () => {
    let debug = false;
    let dlog = function (...args) {
        if (debug) console.log(...args);
    };

    let mod = (a, n) => ((a % n) + n) % n; // 非負の剰余を返す
    let niceDeg = (deg) => mod(deg, 360); // 0 ~ <360 の角度に直す

    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    /**
     * canvas上に配置される長方形とみなせるオブジェクト
     * 位置と幅、高さをもつ。
     * @type {Rectable}
     */
    class Rectable {
        constructor(x, y, w, h) {
            this.x = 0;
            this.y = 0;
            this.deg = 0; // 角度
            // 拡大率 x,yは絶対値　signXは
            this.scale = { x: 1, y: 1 };
            // x座標反転時に-1となる
            this.signX = 1;
            this.w = 0;
            this.h = 0;
            return this;
        }

        setPos(x, y) {
            this.x = x;
            this.y = y;
            return this;
        }

        setSize(w, h) {
            this.w = w;
            this.h = h;
            return this;
        }

        isPortrait() {
            return this.w < this.h;
        }

        isLandscape() {
            return this.w > this.h;
        }

        isMirror() {
            return this.signX == -1;
        }

        mirrorX() {
            this.signX *= -1;
        }

        mirrorY() {
            this.signX *= -1;
            this.addDeg(180);
        }

        calcRealW() {
            return this.w * this.scale.x;
        }

        calcRealH() {
            return this.h * this.scale.y;
        }

        addDeg(deg) {
            this.deg = niceDeg(this.deg + this.signX * deg);
            return this;
        }

        calcRealShort() {
            return Math.min(this.w * this.scale.x, this.h * this.scale.y);
        }

        // 回転を考慮した現在の横向きの長さを引数に合わせる
        fitRealW(w) {
            let len = this.w;
            if (this.deg % 180 == 90) len = this.h;
            this.scale.x = w / len;
            this.scale.y = w / len;
            return this;
        }

        // 回転を考慮した現在の縦向きの長さを引数に合わせる
        fitRealH(h) {
            let len = this.h;
            if (this.deg % 180 == 90) len = this.w;
            this.scale.x = h / len;
            this.scale.y = h / len;
            return this;
        }

        draw(ctx) {
            this.deg = niceDeg(this.deg);
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.scale(this.scale.x * this.signX, this.scale.y);
            ctx.rotate(this.deg * DEG_TO_RAD);
            ctx.drawImage(this.img, -this.w / 2, -this.h / 2);
            ctx.restore();
            return this;
        }

        // canvas.drawImage関数へ渡す際に使用する
        getPosSize = function () {
            return [this.x, this.y, this.w, this.h];
        };
    }

    ////////////////////////////////////////////////////////////////////////////////
    // グローバル定義
    ////////////////////////////////////////////////////////////////////////////////
    // 現在開いているタブページのurl取得
    let iw = window.innerWidth;
    let ih = window.innerHeight;
    let ow = window.outerWidth;
    let oh = window.outerHeight;
    let zoom = 0;
    let baseX, baseY;
    // フチ表示ONの場合に表示されるフレームの余白
    let frameMargin = { w: 300, h: 300 };
    const DEG_TO_RAD = Math.PI / 180;
    let isWide = false; // 表示モード
    let panelScale = 1; // パネルの拡大率
    let viewer; // ビューアを示す要素(div)

    console.log("window width ", window.window.screen.width);
    console.log("window height ", window.window.screen.height);
    let pic = new Rectable(); // picSrcの表示位置とサイズ
    // 新たな Image 要素を作成
    pic.img = new Image();

    let ctx;
    let canvas;
    let frame; // フルスクリーンサイズ時の画像表示部分を示す領域
    let panel; // キャンバスと操作ボタンを含む要素
    let original; // 元ページのhtml
    const DEFAULT_IMAGE =
        "data:image/bmp;base64," +
        "Qk1CAAAAAAAAAD4AAAAoAAAAAQAAAAEAAAABAAE" +
        "AAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP///wCAAAAA";

    ////////////////////////////////////////////////////////////////////////////
    // 関数
    ////////////////////////////////////////////////////////////////////////////
    let tryGetTag = async (tagName, triesMax) => {
        if (triesMax == 0) return null;

        let elem = document.getElementsByTagName(tagName)[0];
        dlog("tagName", tagName, "triesMax", triesMax, "%o", elem);
        if (elem) return elem;

        // 少し待ってリトライ
        await new Promise((ok) => setTimeout(ok, 50));
        return tryGetElement(tagName, triesMax - 1);
    };

    let tryGetElement = async (id, triesMax) => {
        if (triesMax == 0) return null;

        let elem = document.getElementById(id);
        dlog("id", id, "triesMax", triesMax, "%o", elem);
        if (elem) return elem;

        // 少し待ってリトライ
        await new Promise((ok) => setTimeout(ok, 50));
        return tryGetElement(id, triesMax - 1);
    };

    // 指定領域の外側を塗る
    let fillOutOfRect = function (x, y, w, h) {
        ctx.fillRect(0, 0, x + w, y);
        ctx.fillRect(x + w, 0, canvas.width, y + h);
        ctx.fillRect(x, y + h, canvas.width, canvas.height);
        ctx.fillRect(0, y, x, canvas.height);
    };

    // 描画シーケンス全体
    let disp = function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pic.draw(ctx);

        // drawFrameMargin
        frame.x = baseX - frame.w / 2;
        frame.y = baseY - frame.h / 2;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        fillOutOfRect(...frame.getPosSize());
    };

    // キャンバスサイズ切り替え
    let changeCanvasSize = async () => {
        let w = frame.w + (isWide ? frameMargin.w : 0);
        let h = frame.h + (isWide ? frameMargin.h : 0);
        let prevW = canvas.width;
        let prevH = canvas.height;
        canvas.width = w;
        canvas.height = h;
        baseX = canvas.width / 2;
        baseY = canvas.height / 2;
        let dx = (canvas.width - prevW) / 2;
        let dy = (canvas.height - prevH) / 2;
        pic.x += dx;
        pic.y += dy;
        disp();
        fitPanelToWindow();
    };

    // パネルをスケールしてウィンドウにおさめる
    let fitPanelToWindow = async function () {
        // 先にビューワ自体を表示させないと
        viewer.style.width = `${window.innerWidth}px`;
        viewer.style.height = `${window.innerHeight}px`;

        panel = await tryGetElement("grugru_panel", 50);
        let windowSizeRateW = window.innerWidth / panel.clientWidth;
        let windowSizeRateH = window.innerHeight / panel.clientHeight;
        panelScale = Math.min(windowSizeRateW, windowSizeRateH);
        panel.style = `transform:scale(${panelScale})`;
    };

    ////////////////////////////////////////////////////////////////////////////
    // 実行部
    ////////////////////////////////////////////////////////////////////////////
    // div要素を追加してビューアーを埋め込む
    let { url, dataURL } = await chrome.storage.local.get();
    let { viewerText } = await chrome.storage.local.get();

    viewer = await tryGetElement("grugru_image_viewer", 2);
    if (viewer) {
        viewer.remove();
        return;
    }
    viewer = document.createElement("div");
    viewer.id = "grugru_image_viewer";
    viewer.innerHTML = viewerText;
    document.body.appendChild(viewer);

    // キャンバス読み込み
    canvas = await tryGetElement("grugru_canvas", 50);
    ctx = canvas.getContext("2d");

    frame = new Rectable();
    frame.w = window.screen.width;
    frame.h = window.screen.height;
    dlog("frame.w", frame.w);

    // ソースのパスを設定
    pic.img.src = dataURL || url || DEFAULT_IMAGE;
    dlog("dataURL: ", dataURL);
    dlog("url: ", url);

    let output = await tryGetElement("grugru_output", 10);

    // 画像読み込み時イベント
    pic.img.addEventListener(
        "load",
        async function () {
            if (url) {
                output.value = `${url}\r\n`;
            } else if (dataURL) {
                output.value =
                    dataURL.slice(0, 200) +
                    chrome.i18n.getMessage("outputMsgOmit");
            } else {
                output.value = chrome.i18n.getMessage("outputMsgErrNotFound");
            }
            canvas.width = frame.w + (isWide ? frameMargin.w : 0);
            canvas.height = frame.h + (isWide ? frameMargin.h : 0);
            fitPanelToWindow();
            baseX = canvas.width / 2;
            baseY = canvas.height / 2;
            // 画像の描画場所と大きさを指定
            pic.setPos(baseX, baseY).setSize(
                pic.img.naturalWidth,
                pic.img.naturalHeight
            );
            dlog("pic.x y", pic.x, pic.y);
            dlog("pic.w h", pic.w, pic.h);
            disp();
        },
        false
    );

    pic.img.addEventListener("error", async function (e) {
        console.log("pic.img.src error");
        console.log(e);
        pic.img.src = DEFAULT_IMAGE;
        chrome.storage.local.clear();
        dataURL = "";
        url = "";
    });

    ////////////////////////////////////////////////////////////////////////////
    // イベント
    ////////////////////////////////////////////////////////////////////////////

    // ホイール回転イベント：拡大縮小
    document.addEventListener("wheel", (e) => {
        let sign = e.deltaY <= 0 ? 1 : -1;

        // 小さすぎるので縮小しない。
        if (pic.calcRealShort() < 10 && sign < 0) return;

        let delta = (sign * pic.scale.x) / 25;

        pic.scale.x += delta;
        pic.scale.y += delta;
        disp();
    });

    // マウスダウンイベント：画像ドラッグ
    canvas.onmousedown = function (e) {
        // カーソル位置から画像の表示位置のズレ
        let beginX = e.pageX;
        let beginY = e.pageY;
        function onMouseMove(e) {
            // pic.x = e.screenX + d.x;
            // pic.y = e.screenY + d.y;
            pic.x += (e.pageX - beginX) / panelScale;
            pic.y += (e.pageY - beginY) / panelScale;
            disp();
            beginX = e.pageX;
            beginY = e.pageY;
        }
        canvas.addEventListener("mousemove", onMouseMove);

        // マウスボタン離したら追従しない
        // 要素選択と相性が悪いのでcssに user-select: none; を指定するとよい。
        document.onmouseup = function () {
            canvas.removeEventListener("mousemove", onMouseMove);
            document.onmouseup = null;
        };
    };

    // 新規タブで開いた場合タイトルに拡張名を表示
    let pageTitle = await tryGetTag("title", 10);
    if (pageTitle.innerHTML === "Viewer") {
        pageTitle.innerHTML = chrome.i18n.getMessage("name");
    }

    let operateDescription = await tryGetElement(
        "grugru_operate_description",
        10
    );
    let rotateUnticlockwise90deg = await tryGetElement(
        "grugru_rotate_unticlockwise_90deg",
        10
    );
    let rotateClockwise90deg = await tryGetElement(
        "grugru_rotate_clockwise_90deg",
        10
    );
    let mirrorVertical = await tryGetElement("grugru_mirror_vertical", 10);
    let mirrorHorizontal = await tryGetElement("grugru_mirror_horizontal", 10);
    let fitVertical = await tryGetElement("grugru_fit_vertical", 10);
    let fitHorizontal = await tryGetElement("grugru_fit_horizontal", 10);
    let autoAdjust = await tryGetElement("grugru_auto_adjust", 10);
    let toggleDisp = await tryGetElement("grugru_toggle_disp", 10);
    let fullscreen = await tryGetElement("grugru_fullscreen", 10);
    let reset = await tryGetElement("grugru_reset", 10);
    let file = await tryGetElement("grugru_file", 10);
    let fileArea = await tryGetElement("grugru_file_area_label", 10);
    let del = await tryGetElement("grugru_delete", 10);
    let exit = await tryGetElement("grugru_exit", 10);

    // ラベル挿入
    operateDescription.innerHTML = chrome.i18n.getMessage("operateDescription");
    rotateUnticlockwise90deg.innerHTML = chrome.i18n.getMessage(
        "rotateUnticlockwise90deg"
    );
    rotateClockwise90deg.innerHTML = chrome.i18n.getMessage(
        "rotateClockwise90deg"
    );
    mirrorVertical.innerHTML = chrome.i18n.getMessage("mirrorVertical");
    mirrorHorizontal.innerHTML = chrome.i18n.getMessage("mirrorHorizontal");
    fitVertical.innerHTML = chrome.i18n.getMessage("fitVertical");
    fitHorizontal.innerHTML = chrome.i18n.getMessage("fitHorizontal");
    autoAdjust.innerHTML = chrome.i18n.getMessage("autoAdjust");
    toggleDisp.innerHTML = chrome.i18n.getMessage("toggleDisp");
    fullscreen.innerHTML = chrome.i18n.getMessage("fullscreen");
    reset.innerHTML = chrome.i18n.getMessage("reset");
    file.innerHTML = chrome.i18n.getMessage("file");

    fileArea.innerHTML = chrome.i18n.getMessage("fileArea");
    del.innerHTML = chrome.i18n.getMessage("delete");
    exit.innerHTML = chrome.i18n.getMessage("exit");

    // ボタンクリックイベントたち
    rotateUnticlockwise90deg.onclick = () => {
        pic.addDeg(270);
        disp();
    };
    rotateClockwise90deg.onclick = () => {
        pic.addDeg(90);
        disp();
    };
    mirrorVertical.onclick = () => {
        pic.mirrorY();
        disp();
    };
    mirrorHorizontal.onclick = () => {
        pic.mirrorX();
        disp();
    };
    fitVertical.onclick = () => {
        pic.fitRealH(frame.h);
        pic.setPos(baseX, baseY);
        disp();
    };
    fitHorizontal.onclick = () => {
        pic.fitRealW(frame.w);
        pic.setPos(baseX, baseY);
        disp();
    };

    // リセットボタン押下イベント
    reset.onclick = () => {
        pic.scale.x = 1;
        pic.scale.y = 1;
        pic.signX = 1;
        pic.deg = 0;
        pic.setPos(baseX, baseY);
        disp();
    };

    // データ消去ボタン押下イベント
    del.onclick = async function () {
        await chrome.storage.local.clear();
        output.value = chrome.i18n.getMessage("outputMsgDelete");
    };

    // スクリーンに合わせる
    // 縦横自動回転
    autoAdjust.onclick = () => {
        // 画像は縦長、画面は横長 であれば画像を横向きに
        // 右向きか左向きかわからないのでクリックごとに入れ替える
        if (pic.isPortrait() && frame.isLandscape()) {
            pic.addDeg(90);
            if (pic.deg % 180 == 0) {
                pic.addDeg(90);
            }
        } else {
            // 縦長同士なら
            pic.deg = 0;
        }
        let scale1 = pic.fitRealH(frame.h).scale.x;
        let scale2 = pic.fitRealW(frame.w).scale.x;
        pic.scale.x = pic.scale.y = Math.min(scale1, scale2);
        pic.setPos(baseX, baseY);
        disp();
    };

    // フチ表示ON/OFF切り替え
    toggleDisp.onclick = () => {
        isWide = !isWide;
        changeCanvasSize();
    };

    // キャンバスをフルスクリーン表示
    fullscreen.onclick = async () => {
        isWide = false;
        changeCanvasSize();
        canvas.requestFullscreen();
    };

    // ビューアー終了
    exit.onclick = async () => {
        console.log("exit");
        // 新規ページで立ち上がっていた場合はタブを閉じる
        if (document.title == chrome.i18n.getMessage("name")) {
            window.close();
            return;
        }
        // 重ねて表示の場合はビューワーのDOMだけ消す。
        viewer.remove();
    };

    // ファイルリーダーの読み込み先をキャンバス内imageに
    const reader = new FileReader();
    reader.onload = async () => {
        pic.img.src = reader.result;
        dataURL = reader.result;
        await chrome.storage.local.set({ dataURL: dataURL });
    };

    file.addEventListener("change", async function (e) {
        let files = e.target.files;
        console.log("file name: ", files[0].name);
        reader.readAsDataURL(files[0]);
        url = files[0].name;
        await chrome.storage.local.set({ url: url });
    });
};

window.onload = main();
