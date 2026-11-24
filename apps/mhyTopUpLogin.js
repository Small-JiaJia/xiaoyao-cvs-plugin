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
  // #体力 等 ji-plugin 功能直接读 data/yaml/{qq}.yaml 里的 sk，不读数据库，
  // 这里补一份，避免 seachUid 因接口异常提前返回导致 yaml 缺失
  await saveSkYaml(e, res)
  if (isV3) {
    let userck = (await import(`file://${_path}/plugins/genshin/model/user.js`)).default
    await (new userck(e)).bing()
  } else {
    let { bingCookie } = await import(`file://${_path}/lib/app/dailyNote.js`)
    await bingCookie(e)
  }
}

/** 把扫码得到的 stoken 写入 xiaoyao 的 sk 存储（供 ji-plugin 的 CK.get 读取） */
async function saveSkYaml(e, res) {
  try {
    const gsCfg = (await import("../model/gsCfg.js")).default
    const UserModel = (await import("../model/user.js")).default
    const { BIND_GAMES } = await import("../model/user.js")
    const user = new UserModel(e)
    const sk = await utils.getCookieMap(res?.stoken || "")
    const ckMap = await utils.getCookieMap(res?.cookie || "")
    const stuid = sk?.get("stuid") || ckMap?.get("ltuid")
    if (!stuid) {
      Bot.logger.error("[扫码登录] stoken 中缺少 stuid，无法写入 sk 存储")
      return
    }
    // 复用 seachUid 的查询结果：直接查各游戏的角色列表
    const list = []
    for (const game of BIND_GAMES) {
      const board = await user.getBoard(game)
      if (!board) {
        Bot.logger.warn(`[扫码登录] mys.boards 中未找到「${game}」板块，跳过`)
        continue
      }
      user.cookie = res?.cookie || user.cookie
      const r = await user.getData("userGameInfo", board, false)
      if (r?.retcode === 0) list.push(...(r?.data?.list || []))
    }
    if (!list.length) {
      Bot.logger.warn("[扫码登录] 未查到角色，跳过 sk 写入")
      return
    }
    const allData = {}
    for (const s of list) {
      const uid = String(s.game_uid || "")
      if (!gsCfg.isValidUid(uid)) continue
      allData[uid] = {
        stuid,
        stoken: sk?.get("stoken"),
        // ltoken 从 cookie 串里取（exchange 换出来的真实 ltoken）
        ltoken: ckMap?.get("ltoken") || sk?.get("ltoken"),
        mid: sk?.get("mid"),
        uid,
        userId: e.user_id,
        is_sign: true,
        region_name: s.region_name,
        region: s.region
      }
    }
    await gsCfg.saveBingStoken(e.user_id, allData)
    Bot.logger.mark(`[扫码登录] sk 写入完成 qq:${e.user_id} 角色数:${Object.keys(allData).length}`)
  } catch (err) {
    Bot.logger.error(`[扫码登录] 写入 sk 存储异常：${err.message}`)
  }
}
