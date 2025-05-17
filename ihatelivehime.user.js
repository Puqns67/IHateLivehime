// ==UserScript==
// @name        IHateLivehime
// @name:zh-CN  我讨厌直播姬
// @description 在个人直播间添加“开始直播”与“结束直播”按钮，让低粉丝数的用户也能绕开强制要求的直播姬开播。
// @match       https://live.bilibili.com/*
// @icon        https://i0.hdslb.com/bfs/static/jinkela/long/images/favicon.ico
// @version     0.1.2
// @author      Puqns67
// @namespace   https://github.com/Puqns67
// @@updateURL  https://github.com/Puqns67/IHateLivehime/raw/refs/heads/master/ihatelivehime.user.js
// @downloadURL https://github.com/Puqns67/IHateLivehime/raw/refs/heads/master/ihatelivehime.user.js
// @homepageURL https://github.com/Puqns67/IHateLivehime
// @supportURL  https://github.com/Puqns67/IHateLivehime/issues
// ==/UserScript==

(async function () {
	'use strict';

	function sleep(time) {
		return new Promise((resolve) => setTimeout(resolve, time));
	}

	async function get_element_with_wait(selectors, timeout = 3200, retry_count = 32) {
		let timeout_once = timeout / 32;
		let retry = 1;

		while (retry <= retry_count) {
			let result = document.querySelector(selectors);
			if (result !== null) return result;
			await sleep(timeout_once);
			retry++;
		}

		return null;
	}

	function get_cookie(name) {
		let re = new RegExp(`(?:^|; *)${name}=([^=]+?)(?:;|$)`).exec(document.cookie);
		if (re === null) {
			return null;
		}
		return re[1];
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

	async function start_live(room_id) {
		let room_info = await get_room_info_by_room_id(room_id);

		if (room_info.code !== 0) {
			alert(`${response.msg}\n错误代码：${response.code}\n${response.toString()}`);
			return;
		}

		if (room_info.data.live_status === 1) {
			alert("房间已开播！")
			return;
		}

		let bili_jct = get_cookie("bili_jct");

		if (bili_jct === null) {
			alert("Cookie \"bili_jct\" 不应为空！");
			return;
		}

		let params = new URLSearchParams({
			"room_id": room_id,
			"area_v2": room_info.data.area_id,
			"platform": "pc_link",
			"csrf": bili_jct
		}).toString();

		let response = await fetch("https://api.live.bilibili.com/room/v1/Room/startLive?" + params, { "method": "POST", "credentials": "include" }).then(r => r.json());

		if (response.code !== 0) {
			alert(`${response.msg}\n错误代码：${response.code}\n${response.toString()}`);
			return;
		}

		alert(`推流地址：${response.data.rtmp.addr}\n推流密钥：${response.data.rtmp.code}`);
	}

	async function stop_live(room_id) {
		let room_info = await get_room_info_by_room_id(room_id);

		if (room_info.code !== 0) {
			alert(`${response.msg}\n错误代码：${response.code}\n${response.toString()}`);
			return;
		}

		if ([0, 2].includes(room_info.data.live_status)) {
			alert("房间未开播！")
			return;
		}

		let bili_jct = get_cookie("bili_jct");
		if (bili_jct === null) {
			alert("Cookie \"bili_jct\" 不应为空！");
			return;
		}

		let params = new URLSearchParams({
			"room_id": room_id,
			"csrf": bili_jct
		}).toString();

		let response = await fetch("https://api.live.bilibili.com/room/v1/Room/stopLive?" + params, { "method": "POST", "credentials": "include" }).then(r => r.json());

		if (response.code !== 0) {
			alert(`${response.msg}\n错误代码：${response.code}\n${response.toString()}`);
			return;
		}

		alert("操作成功");
	}

	let path_room_id = /^\/(\d+)$/.exec(document.location.pathname)

	if (path_room_id === null) {
		console.log("当前页面并非直播间！");
		return;
	}

	let room_id = Number(path_room_id[1])

	let current_user_info = await get_current_user_info()
	let current_room_info = await get_room_info_by_room_id(room_id)

	if (current_user_info.data.mid !== current_room_info.data.uid) {
		console.log("当前直播间不为自己的直播间！");
		return;
	}

	let button_area = await get_element_with_wait(".left-header-area");

	if (button_area === null) {
		console.log("页面元素不存在！");
		return;
	}

	let start_live_button = document.createElement("button");
	start_live_button.appendChild(document.createTextNode("开始直播"));
	start_live_button.addEventListener("click", async () => start_live(room_id));

	let stop_live_button = document.createElement("button");
	stop_live_button.appendChild(document.createTextNode("结束直播"));
	stop_live_button.addEventListener("click", async () => stop_live(room_id));

	button_area.appendChild(start_live_button);
	button_area.appendChild(stop_live_button);

	console.log("开/下播按钮已添加！");
}());
