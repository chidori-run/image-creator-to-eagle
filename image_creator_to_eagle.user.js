// ==UserScript==
// @name         Image Creator to Eagle
// @namespace    https://runrunsketch.net/
// @version      1.0.1
// @description  Image Creatorで生成した画像をEagleに登録する
// @author       Chidori Run
// @copyright    2025 Chidori Run
// @license      MIT License
// @match        https://www.bing.com/images/*
// @grant        GM.xmlHttpRequest
// @connect      localhost
// @updateURL    https://github.com/chidori-run/image-creator-to-eagle/raw/refs/heads/main/image_creator_to_eagle.user.js
// @downloadURL  https://github.com/chidori-run/image-creator-to-eagle/raw/refs/heads/main/image_creator_to_eagle.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Image Creatorで生成した画像をEagleに自動登録する
    let registeredImages = []; // Eagleに登録済の画像
    const MAX_IMAGE_HISTORY_COUNT = 10; // registeredImagesの最大要素数

    const CHECK_INTERVAL_MS = 2000;

    // Eagleアプリが起動しているかを確認する
    function checkEagleWake() {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: "GET",
                url: "http://localhost:41595/api/application/info",
                onload: function (response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve();
                    } else {
                        console.error("Eagle Connection Error - HTTP Status:", response.status);
                        console.error("Response Text:", response.responseText);
                        reject();
                    }
                },
                onerror: function (error) {
                    console.error("Eagle Connection Error - Request failed:", error);
                    reject();
                }
            });
        });
    }

    function cleanText(text) {
        return text.replace(/(?:\. Image \d+ of \d+|。画像 \d+\/\d+)$/, '').trim();
    }

    // Eagleに送る
    function sendImgToEagle(imgId, imgSrc, imgPrompt) {
        const item = {
            "url": imgSrc,
            "name": imgPrompt,
            "website": "",
            "tags": "",
            "annotation": imgPrompt,
        };

        GM.xmlHttpRequest({
            url: "http://localhost:41595/api/item/addFromURL",
            method: "POST",
            data: JSON.stringify(item),
            onload: function (response) {
                console.log(response.responseText);
                if (registeredImages.length >= MAX_IMAGE_HISTORY_COUNT) {
                    registeredImages.shift(); // 最大要素数を超えたら古い要素から削除
                }

                registeredImages.push(imgId); // 新しいimgIdを追加
            },
            onerror: function (error) {
                console.error("Eagleへの送信失敗:", error);
            }
        });
    }

    console.log("window type: " + typeof window)
    if (typeof window === 'object') {
        syncImagesToEagle();
    }

    async function syncImagesToEagle() {
        console.log("syncImagesToEagle start")
        while (true) {
            await generatedImgToEagle();
            await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS))
        }
    }

    // 新規画像が生成されたかチェックしてEagleに画像を登録する
    async function generatedImgToEagle() {
        // 新規画像が生成されたかチェック
        let imageContainers = [];

        imageContainers.push(document.getElementById('img-cont-0'));
        imageContainers.push(document.getElementById('img-cont-1'));
        imageContainers.push(document.getElementById('img-cont-2'));
        imageContainers.push(document.getElementById('img-cont-3'));

        for (const container of imageContainers) {
            if (!container) continue;

            const rawAttr = container.getAttribute('m');
            if (!rawAttr) continue;

            let obj;
            try {
                obj = JSON.parse(rawAttr);
            } catch (e) {
                console.error("属性 m のJSONパースに失敗:", e);
                continue;
            }

            const imgId = obj.ContentId;
            if (registeredImages.includes(imgId)) continue;

            // console.log(imgId);
            let customData;
            try {
                customData = JSON.parse(obj.CustomData);
            } catch (e) {
                console.error("CustomDataのJSONパースに失敗:", e);
                continue;
            }

            const imgSrc = customData.MediaUrl;
            const imgToolTip = customData.ToolTip;
            const imgPrompt = cleanText(imgToolTip);
            // 生成画像をEagleに送る
            try {
                await checkEagleWake();
                sendImgToEagle(imgId, imgSrc, imgPrompt);
            } catch (error) {
                alert("Eagleに接続できませんでした。\nアプリが起動しているか確認してください。");
                // アラートが閉じられたら次の処理に進む
                sendImgToEagle(imgId, imgSrc, imgPrompt);
            }

        }

    }

})();