import { isV3 } from "../components/Changelog.js"
import mys from "../model/mhyTopUpLogin.js"
import Common from "../components/Common.js"
import utils from "../model/mys/utils.js"
import { xiaoyaoQr } from "../model/qrStyle.js"
import { Cfg } from "../components/index.js"
import { bindStoken } from "./user.js"

const _path = process.cwd()

export const rule = {
  qrCodeLogin: {
    // 扫码登录下层固定请求原神 hk4e_cn，未做多游戏适配，故不提供星铁/绝区零别名
    reg: "^#(扫码|二维码|辅助)(登录|绑定|登陆)$",
    describe: "扫码登录"
  },
  UserPassMsg: {
    reg: "^#(账号|密码)(密码)?(登录|绑定|登陆)$",
    describe: "账号密码登录"
  },
  UserPassLogin: {
    reg: "^账号(.*)密码(.*)$",
    describe: "账号密码登录"
  }
}

export async function qrCodeLogin(e, { render }) {
  let power = Cfg.get("mhy.qrcode")
  if (power === 3) return false
  if (power == 2 && !e.isPrivate) return false
  if (power == 1 && !e.isGroup) return false

  let Mys = new mys(e)
  let res = await Mys.qrCodeLogin()
  if (!res?.data) return false

  const image = await Common.render("qrCode/index", {
    url: res.data.url,
    Qrsvg: [ xiaoyaoQr(res.data.url) ]
  }, { e, render, retType: "base64", scale: 1.2 })

  // 设置5分钟缓存避免重复触发
  await utils.redisSet(e.user_id, "GetQrCode", { GetQrCode: 1, image }, 60 * 5)
  await e.reply([ "请扫码以完成绑定\n", image ], false, { at: true, recallMsg: 60 })

  res = await Mys.GetQrCode(res.data.ticket)
  if (!res) return true
  await bindSkCK(e, res)
  return true
}

export async function UserPassMsg(e) {
  if (!e.isPrivate) return false
  let Mys = new mys(e)
  await Mys.UserPassMsg()
  return true
}

export async function UserPassLogin(e) {
  if (!e.isPrivate) return false
  let Mys = new mys(e)
  let res = await Mys.UserPassLogin()
  if (res) await bindSkCK(e, res)
  return res
}

export async function bindSkCK(e, res) {
  e.msg = res?.stoken
  e.raw_message = res?.stoken
  e.isPrivate = true
  await bindStoken(e, "1")
  e.ck = res?.cookie
  e.msg = res.cookie
  e.raw_message = res.cookie
  if (isV3) {
    let userck = (await import(`file://${_path}/plugins/genshin/model/user.js`)).default
    await (new userck(e)).bing()
  } else {
    let { bingCookie } = await import(`file://${_path}/lib/app/dailyNote.js`)
    await bingCookie(e)
  }
}
