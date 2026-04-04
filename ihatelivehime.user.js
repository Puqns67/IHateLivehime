// ==UserScript==
// @name        IHateLivehime
// @name:zh-CN  我讨厌直播姬
// @description 在个人直播间添加“开始直播”与“结束直播”按钮，让低粉丝数的用户也能绕开强制要求的直播姬开播。
// @author      Puqns67
// @copyright   2025-2026, Puqns67 (https://github.com/Puqns67)
// @license     GPL-3.0-or-later; https://www.gnu.org/licenses/gpl-3.0.txt
// @version     0.1.7.1
// @icon        https://i0.hdslb.com/bfs/static/jinkela/long/images/favicon.ico
// @homepageURL https://github.com/Puqns67/IHateLivehime
// @supportURL  https://github.com/Puqns67/IHateLivehime/issues
// @namespace   https://github.com/Puqns67
// @downloadURL https://openuserjs.org/install/Puqns67/IHateLivehime.min.user.js
// @updateURL   https://openuserjs.org/meta/Puqns67/IHateLivehime.meta.js
// @match       https://live.bilibili.com/*
// @require     https://cdn.jsdelivr.net/npm/js-md5/build/md5.min.js
// @require     https://cdn.jsdelivr.net/gh/datalog/qrcode-svg/qrcode.min.js
// @grant       GM_addStyle
// @grant       GM_setClipboard
// ==/UserScript==

'use strict';

const APPKEY = "aae92bc66f3edfab";
const APPSEC = "af125a0d5279fd576c1b4418a3e8276d";

class Popup {
	constructor() {
		this.popup = document.createElement("div");
		this.popup.id = "ihatelivehime-popup";
		this.title = document.createElement("p");
		this.title.id = "ihatelivehime-popup-title";
		this.content = document.createElement("div");
		this.content.id = "ihatelivehime-popup-content";
		this.actions = document.createElement("div");
		this.actions.id = "ihatelivehime-popup-actions";

		this.close_button = document.createElement("button");
		this.close_button.id = "ihatelivehime-popup-close-button";
		this.close_button.appendChild(document.createTextNode("关闭"));
		this.close_button.addEventListener("click", async () => this.hide());

		this.popup.appendChild(this.title);
		this.popup.appendChild(this.content);
		this.popup.appendChild(this.actions);
		this.popup.appendChild(this.close_button);
		document.body.appendChild(this.popup);

		GM_addStyle(`
			#ihatelivehime-popup {
				position: fixed;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				display: none;
				flex-direction: column;
				padding: 15px;
				border: 5px solid #f1a9b4ee;
				border-radius: 8px;
				color: white;
				background-color: #9c5a65ee;
				box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
				z-index: 1000;
			}

			#ihatelivehime-popup > * {
				margin-top: 10px;
			}

			#ihatelivehime-popup-title {
				margin: unset;
				font-size: 1.8em;
			}

			#ihatelivehime-popup-content {
				display: flex;
				flex-direction: column;
				font-size: 1.2em;
			}

			#ihatelivehime-popup-content > svg {
				align-self: center;
				fill: #ff99aa;
			}

			#ihatelivehime-popup-content > code {
				background-color: #7d5158ee;
				border-radius: 3px;
				font-family: Consolas, Liberation Mono, monospace;
				padding: 3px;
				max-width: 40vw;
				overflow-x: auto;
				white-space: nowrap;
			}

			#ihatelivehime-popup-actions {
				display: flex;
				gap: 10px;
			}

			#ihatelivehime-popup-actions > button, #ihatelivehime-popup-close-button {
				flex: auto;
				padding: 3px 10px;
				font-size: 1.2em;
				border: none;
				border-radius: 5px;
				color: white;
				background-color: #ff0055ee;
				cursor: pointer;
			}
		`);
	}

	action_element(action) {
		let button = document.createElement("button");
		button.textContent = action.title;
		switch (action.type) {
			case "exec":
				button.addEventListener("click", action.value);
				break;
			case "copy":
				button.addEventListener("click", async () => GM_setClipboard(action.value));
				break;
			default:
				throw new Error(`Unknown action type: ${action.type}`);
		}
		return button;
	}

	show(title, content = null, actions = null) {
		this.title.textContent = title;

		if (content !== null) {
			this.content.style.removeProperty("display");
			this.content.replaceChildren();
			if (typeof content === "string")
				this.content.textContent = content;
			else
				content.forEach(element => this.content.appendChild(element));

		} else {
			this.content.style.display = "none";
		}

		if (actions !== null) {
			this.actions.style.removeProperty("display");
			this.actions.replaceChildren();
			actions.forEach(action => this.actions.appendChild(this.action_element(action)));
		} else {
			this.actions.style.display = "none";
		}

		this.popup.style.display = "flex";
	}

	hide() {
		this.popup.style.removeProperty("display");
	}
}

function get_element_with_wait(selector, timeout = 10000) {
	return new Promise((resolve, reject) => {
		const element = document.querySelector(selector);
		if (element) return resolve(element);

		const observer = new MutationObserver(() => {
			const el = document.querySelector(selector);
			if (el) {
				observer.disconnect();
				resolve(el);
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });

		setTimeout(() => {
			observer.disconnect();
			reject();
		}, timeout);
	});
}

function get_cookie(name) {
	let re = new RegExp(`(?:^|; *)${name}=([^=]+?)(?:;|$)`).exec(document.cookie);
	return re === null ? null : re[1];
}

function api_alert(popup, object) {
	popup.show("请求接口错误", `错误代码：${object.code}<br/>${object.message}`, [
		{ title: "复制错误详情", type: "copy", value: JSON.stringify(object) }
	]);
}

async function get_timestemp() {
	return await fetch("https://api.bilibili.com/x/report/click/now").then(r => r.json());
}

async function get_current_liveime_version() {
	return await fetch('https://api.live.bilibili.com/xlive/app-blink/v1/liveVersionInfo/getHomePageLiveVersion?system_version=2').then(r => r.json());
}

async function get_current_user_info() {
	return await fetch("https://api.bilibili.com/x/space/myinfo", { "credentials": "include" }).then(r => r.json());
}

async function get_room_info_by_room_id(id) {
	return await fetch(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${id}`, { "credentials": "include" }).then(r => r.json());
}

async function get_room_info_by_user_id(id) {
	return await fetch(`https://api.live.bilibili.com/live_user/v1/Master/info?uid=${id}`, { "credentials": "include" }).then(r => r.json());
}

async function start_live(popup, room_id) {
	let bili_jct = get_cookie("bili_jct");
	if (bili_jct === null) {
		popup.show("无法开始直播", 'Cookie "bili_jct" 不存在，请尝试重新登录！');
		return;
	}

	let room_info = await get_room_info_by_room_id(room_id);
	if (room_info.code !== 0) {
		api_alert(popup, room_info);
		return;
	}
	if (room_info.data.live_status === 1) {
		popup.show("无法开始直播", "房间已开播！");
		return;
	}

	let current_timestemp = await get_timestemp();
	if (current_timestemp.code !== 0) {
		api_alert(popup, current_timestemp);
		return;
	}

	let current_liveime_version = await get_current_liveime_version();
	if (current_liveime_version.code !== 0) {
		api_alert(popup, current_liveime_version);
		return;
	}

	let data = {
		"appkey": APPKEY,
		"area_v2": room_info.data.area_id,
		"build": current_liveime_version.data.build,
		"csrf": bili_jct,
		"platform": "pc_link",
		"room_id": room_id,
		"ts": current_timestemp.data.now,
		"version": current_liveime_version.data.curr_version
	};
	data.sign = md5(new URLSearchParams(data).toString() + APPSEC);

	let params = new URLSearchParams(data).toString();

	let response = await fetch("https://api.live.bilibili.com/room/v1/Room/startLive?" + params, { "method": "POST", "credentials": "include" }).then(r => r.json());
	if (response.code !== 0) {
		switch (response.code) {
			case 60024:
				popup.show("需要人脸验证", [QRCode({ msg: response.data.qr, pad: 0 })], [
					{ title: "继续", type: "exec", value: async () => start_live(room_id) }
				]);
				break;
			default:
				api_alert(popup, response);
				break;
		}
		return;
	}

	let push_address_title = document.createElement("span");
	push_address_title.appendChild(document.createTextNode("推流地址："));
	let push_address_code = document.createElement("code");
	push_address_code.appendChild(document.createTextNode(response.data.rtmp.addr))

	let push_token_title = document.createElement("span");
	push_token_title.appendChild(document.createTextNode("推流密钥："));
	let push_token_code = document.createElement("code");
	push_token_code.appendChild(document.createTextNode(response.data.rtmp.code))

	popup.show("开始直播成功", [push_address_title, push_address_code, push_token_title, push_token_code], [
		{ title: "复制推流地址", type: "copy", value: response.data.rtmp.addr },
		{ title: "复制推流密钥", type: "copy", value: response.data.rtmp.code }
	]);
}

async function stop_live(popup, room_id) {
	let bili_jct = get_cookie("bili_jct");
	if (bili_jct === null) {
		popup.show("无法关闭直播", 'Cookie "bili_jct" 不存在，请尝试重新登录！');
		return;
	}

	let room_info = await get_room_info_by_room_id(room_id);
	if (room_info.code !== 0) {
		api_alert(popup, room_info);
		return;
	}
	if ([0, 2].includes(room_info.data.live_status)) {
		popup.show("无法关闭直播", "房间未开播！");
		return;
	}

	let params = new URLSearchParams({
		"platform": "pc_link",
		"room_id": room_id,
		"csrf": bili_jct
	}).toString();

	let response = await fetch("https://api.live.bilibili.com/room/v1/Room/stopLive?" + params, { "method": "POST", "credentials": "include" }).then(r => r.json());
	if (response.code !== 0) {
		api_alert(popup, response);
		return;
	}

	popup.show("关闭直播成功！");
}

(async function () {
	let popup = new Popup();

	let path_room_id = /^\/(\d+)/.exec(document.location.pathname);
	if (path_room_id === null) {
		console.warn("当前页面并非直播间");
		return;
	}
	let room_id = Number(path_room_id[1]);

	let current_user_info = await get_current_user_info();
	if (current_user_info.code === -101) {
		console.warn("账户未登录");
		return;
	}

	let current_room_info = await get_room_info_by_room_id(room_id);

	if (current_user_info.data.mid !== current_room_info.data.uid) {
		console.warn("当前直播间不为自己的直播间");
		return;
	}

	let admin_drop = await get_element_with_wait(".admin-drop-ctnr");
	if (admin_drop === null) {
		console.warn("页面元素不存在");
		return;
	}
	let admin_drop_first_item = admin_drop.children[0];

	let start_live_button = admin_drop_first_item.cloneNode();
	start_live_button.appendChild(document.createTextNode("开始直播"));
	start_live_button.addEventListener("click", async () => start_live(popup, room_id));

	let stop_live_button = admin_drop_first_item.cloneNode();
	stop_live_button.appendChild(document.createTextNode("结束直播"));
	stop_live_button.addEventListener("click", async () => stop_live(popup, room_id));

	admin_drop.insertBefore(start_live_button, admin_drop_first_item);
	admin_drop.insertBefore(stop_live_button, admin_drop_first_item);

	// 修复在直播间实验室中启用深色模式后无法点击顶栏中元素的问题（上游 BUG）
	GM_addStyle("html[lab-style*='dark'] #head-info-vm.bg-bright-filter::before { pointer-events: none }");
}());
