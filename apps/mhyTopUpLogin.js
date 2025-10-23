import {
	isV3
} from '../components/Changelog.js'
import mys from "../model/mhyTopUpLogin.js"
import Common from "../components/Common.js";
import { bindStoken } from './user.js'
import utils from '../model/mys/utils.js';
import {
	Cfg,
} from "../components/index.js";
import SimpleQr from 'simple-qrbtf'
import lodash from 'lodash'
const _path = process.cwd();
export const rule = {
	qrCodeLogin: {
		reg: `^#(绝区零|星铁)?(扫码|二维码|辅助)(登录|绑定|登陆)$`,
		describe: "扫码登录"
	},
	UserPassMsg: {
		reg: `^#(账号|密码)(密码)?(登录|绑定|登陆)$`,
		describe: "账号密码登录"
	},
	UserPassLogin: {
		reg: `^账号(.*)密码(.*)$`,
		describe: "账号密码登录"
	},
	// payOrder: {
	// 	/** 命令正则匹配 */
	// 	reg: '^#?((原神(微信)?充值(微信)?(.*))|((商品|充值)列表)|((订单|查询)(订单|查询)(.*)))$',
	// 	/** 执行方法 */
	// 	describe: '原神充值（离线）'
	// }
}


export async function payOrder (e, { render }) {
	let Mys = new mys(e)
	if (/(商品|充值)列表/.test(e.msg)) {
		return await Mys.showgoods({ render })
	} else if (/(订单|查询)(订单|查询)/.test(e.msg)) {
		return await Mys.checkOrder()
	} else if (e.msg.includes('充值')) {
		return await Mys.GetCode({ render })
	}
	return false;
}

export async function qrCodeLogin (e, { render }) {
	let power = Cfg.get("mhy.qrcode")
	if (power === 3) {
		return false;
	} else {
		if (power == 2 && !e.isPrivate) {
			return false;
		}
		if (power == 1 && !e.isGroup) {
			return false;
		}
	}
	let Mys = new mys(e)
	let res = await Mys.qrCodeLogin()
	if (!res?.data) return false;

	const image = await Common.render(`qrCode/index`, {
		url: res.data.url,
		Qrsvg: [
			...lodash.sampleSize(['dsj', 'func', 'base', 'circle', 'randRect', 'line'], 4)
				.map(type => SimpleQr[type]({
					// level: 'Q',
					content: res.data.url,
					funcType: lodash.sample(['A', 'B']),
					direction: lodash.sample(['left-right', 'up-down', 'h-v', 'loop', 'topLeft-bottomRight', 'topRight-bottomLeft', 'cross']),
					// darkColor: '#' + lodash.sample(['000000', 'FF6900', 'FCB900', '7BDCB5', '00D084', '8ED1FC', '0693E3', 'ABB8C3', 'EB144C', 'F78DA7', '9900EF']),
					lineColor: '#' + lodash.sample(['000000', 'FF6900', 'FCB900', '7BDCB5', '00D084', '8ED1FC', '0693E3', 'ABB8C3', 'EB144C', 'F78DA7', '9900EF']),
					posColor: '#' + lodash.sample(['000000', 'FF6900', 'FCB900', '7BDCB5', '00D084', '8ED1FC', '0693E3', 'ABB8C3', 'EB144C', 'F78DA7', '9900EF']),
					otherColor: '#' + lodash.sample(['000000', 'FF6900', 'FCB900', '7BDCB5', '00D084', '8ED1FC', '0693E3', 'ABB8C3', 'EB144C', 'F78DA7', '9900EF']),
					otherColor1: '#' + lodash.sample(['000000', 'FF6900', 'FCB900', '7BDCB5', '00D084', '8ED1FC', '0693E3', 'ABB8C3', 'EB144C', 'F78DA7', '9900EF']),
					otherColor2: '#FFFFFF00'
				}))
		]
	}, {
		e,
		render, retType: 'base64',
		scale: 1.2
	})
	await utils.redisSet(e.user_id, "GetQrCode", { GetQrCode: 1, image }, 60 * 5) //设置5分钟缓存避免重复触发

	await e.reply(['请扫码以完成绑定\n', image], false, { at: true, recallMsg: 60 })

	res = await Mys.GetQrCode(res.data.ticket)
	if (!res) return true;
	await bindSkCK(e, res)
	return true;
}


export async function UserPassMsg (e) {
	if (!e.isPrivate) {
		return false;
	}
	let Mys = new mys(e)
	await Mys.UserPassMsg()
	return true;
}


export async function UserPassLogin (e) {
	if (!e.isPrivate) {
		return false;
	}
	let Mys = new mys(e)
	let res = await Mys.UserPassLogin();
	if (res) await bindSkCK(e, res)
	return res;
}

export async function bindSkCK (e, res) {
	e.msg = res?.stoken, e.raw_message = res?.stoken
	e.isPrivate = true
	await bindStoken(e, '1')
	e.ck = res?.cookie, e.msg = res.cookie, e.raw_message = res.cookie;
	if (isV3) {
		let userck = (await import(`file://${_path}/plugins/genshin/model/user.js`)).default
		await (new userck(e)).bing()
	} else {
		let {
			bingCookie
		} = (await import(`file://${_path}/lib/app/dailyNote.js`))
		await bingCookie(e)
	}
}
