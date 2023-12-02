"use strict";

// 現在開いているタブページのurl取得
let iw = window.innerWidth;
let ih = window.innerHeight;
let ow = window.outerWidth;
let oh = window.outerHeight;
let zoom = 0;
let baseX, baseY;
let frameMargin = { w: 300, h: 300 }; // フチ表示ONの場合に表示されるフレームの余白
const DEG_TO_RAD = Math.PI / 180;
let isWide = false; // 表示モード
let panelScale = 1; // パネルの拡大率

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
        // 拡大率 x,yは絶対値　signX, signYはそれぞれx座標、y座標反転時に-1となる
        this.scale = { x: 1, y: 1, signX: 1, signY: 1 };
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

    calcRealW() {
        return this.w * this.scale.x;
    }

    calcRealH() {
        return this.h * this.scale.y;
    }

    addDeg(deg) {
        this.deg += this.scale.signX * this.scale.signY * deg;
        return this;
    }

    calcRealShort() {
        return Math.min(this.w * this.scale.x, this.h * this.scale.y);
    }

    fitRealW(w) {
        if (this.deg % 180 == 0) {
            // 通常
            this.scale.x = w / pic.w;
            this.scale.y = this.scale.x;
        } else {
            // 縦横が入れ替わっている
            this.scale.y = w / pic.h;
            this.scale.x = this.scale.y;
        }
        return this;
    }

    fitRealH(h) {
        if (this.deg % 180 == 0) {
            // 通常
            this.scale.y = h / pic.h;
            this.scale.x = this.scale.y;
        } else {
            // 縦横が入れ替わっている
            this.scale.x = h / pic.w;
            this.scale.y = this.scale.x;
        }
        return this;
    }

    draw(ctx) {
        this.deg %= 360;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(
            this.scale.x * this.scale.signX,
            this.scale.y * this.scale.signY
        );
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
console.log("window width ", window.window.screen.width);
console.log("window height ", window.window.screen.height);
let pic = new Rectable(); // picSrcの表示位置とサイズ
// 新たな Image 要素を作成
pic.img = new Image();

let ctx;
let canvas;
let frame; // フルスクリーンサイズ時の画像表示部分を示す領域
let panel; // キャンバスと操作ボタンを含む要素

////////////////////////////////////////////////////////////////////////////////
// 要素を取得する関数
////////////////////////////////////////////////////////////////////////////////
let tryGetElement = async (id, triesMax) => {
    if (triesMax == 0) return null;

    let elem = document.getElementById(id);
    console.log("id", id, "triesMax", triesMax, "%o", elem);
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

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var main = async () => {
    let dbgSize = () => {
        console.log(`拡大率 : ${zoom}`);
        console.log(
            `画面サイズ：\r\n` +
                ` 横 ${window.screen.width}\r\n` +
                ` 縦 ${window.screen.height}\r\n` +
                `ウィンドウ内サイズ： \r\n` +
                ` 横 ${window.innerWidth}\r\n` +
                ` 縦 ${window.innerHeight}\r\n` +
                `ウィンドウ外側サイズ： \r\n` +
                ` 横 ${window.outerWidth}\r\n` +
                ` 縦 ${window.outerHeight}\r\n`
        );
    };
    dbgSize();

    canvas = await tryGetElement("canvas", 50);

    ctx = canvas.getContext("2d");

    frame = new Rectable();
    frame.w = window.screen.width;
    frame.h = window.screen.height;
    console.log("frame.w", frame.w);

    // 画像読み込み時イベント
    pic.img.addEventListener(
        "load",
        async function () {
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
            console.log("pic.x y", pic.x, pic.y);
            console.log("pic.w h", pic.w, pic.h);
            disp();
        },
        false
    );

    let { url } = await chrome.storage.local.get();
    console.log("%o", url);
    pic.img.src = url; // ソースのパスを設定

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

    let rotateUnticlockwise90deg = await tryGetElement(
        "rotate_unticlockwise_90deg"
    );
    let rotateClockwise90deg = await tryGetElement("rotate_clockwise_90deg");
    let mirrorVertical = await tryGetElement("mirror_vertical");
    let mirrorHorizontal = await tryGetElement("mirror_horizontal");
    let fitVertical = await tryGetElement("fit_vertical");
    let fitHorizontal = await tryGetElement("fit_horizontal");
    let autoAdjust = await tryGetElement("auto_adjust");
    let toggleDisp = await tryGetElement("toggle_disp");
    let fullscreen = await tryGetElement("fullscreen");
    let reset = await tryGetElement("reset");

    // ボタンクリックイベントたち
    rotateUnticlockwise90deg.onclick = () => {
        pic.addDeg(-90);
        disp();
    };
    rotateClockwise90deg.onclick = () => {
        pic.addDeg(90);
        disp();
    };
    mirrorVertical.onclick = () => {
        pic.scale.signY *= -1;
        disp();
    };
    mirrorHorizontal.onclick = () => {
        pic.scale.signX *= -1;
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
        pic.scale.signX = 1;
        pic.scale.signY = 1;
        pic.deg = 0;
        pic.setPos(baseX, baseY);
        disp();
    };

    // スクリーンに合わせる
    // 縦横自動回転
    autoAdjust.onclick = () => {
        if (pic.h > pic.w && frame.h < frame.w) {
            if (pic.deg == 90) pic.deg = -90;
            else pic.deg = 90;
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
};

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
    panel = await tryGetElement("panel", 50);
    let windowSizeRateW = window.innerWidth / panel.clientWidth;
    let windowSizeRateH = window.innerHeight / panel.clientHeight;
    panelScale = Math.min(windowSizeRateW, windowSizeRateH);
    panel.style = `transform:scale(${panelScale})`;
};

window.onload = main();
