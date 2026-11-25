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
  // 扫码返回的 stoken 串只有 stoken/stuid/mid，ltoken 在 cookie 串里。
  // 这里把 ltoken 合并进 sk，否则 seachUid / saveSkYaml 取不到，#体力 会缺 ltoken。
  const ckMap = await utils.getCookieMap(res?.cookie || "")
  const ltoken = ckMap.get("ltoken") || ""
  const skStr = ltoken ? `${res?.stoken};ltoken=${ltoken}` : res?.stoken
  e.msg = skStr
  e.raw_message = skStr
  e.isPrivate = true
  // sign 类接口（userGameInfo 等）读的是 e.cookie，提前设好，
  // 即使 bindStoken 里的 exchange 异常，后续查角色也有 Cookie 可用
  e.cookie = res?.cookie
  // 扫码时已经 exchange 过一次，复用结果，避免二次 exchange 触发 -3001
  e.exData = res?.exchange
  await bindStoken(e, "1")
  e.ck = res?.cookie
  e.cookie = res?.cookie
  e.msg = res.cookie
  e.raw_message = res.cookie
  if (isV3) {
    let userck = (await import(`file://${_path}/plugins/genshin/model/user.js`)).default
    await (new userck(e)).bing()
  } else {
    let { bingCookie } = await import(`file://${_path}/lib/app/dailyNote.js`)
    await bingCookie(e)
  }
  // #体力 等 ji-plugin 功能直接读 data/yaml/{qq}.yaml 里的 sk，不读数据库。
  // 放在 bing 之后：此时数据库里已有角色 uid，接口查询失败时可以兜底，
  // 避免出现「绑定成功但 sk 没写入」导致 #更新抽卡记录 / #体力 全部失效。
  await saveSkYaml(e, res)
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
    // userGameInfo 读的是 e.cookie，绑定流程里可能被 getCookie 清空，这里再兜一次
    if (!e.cookie) e.cookie = res?.cookie
    // 复用 seachUid 的查询结果：直接查各游戏的角色列表
    const list = []
    for (const game of BIND_GAMES) {
      const board = await user.getBoard(game)
      if (!board) {
        Bot.logger.warn(`[扫码登录] mys.boards 中未找到「${game}」板块，跳过`)
        continue
      }
      const r = await user.getData("userGameInfo", board, false)
      if (r?.retcode === 0) {
        list.push(...(r?.data?.list || []))
      } else {
        Bot.logger.warn(`[扫码登录] 查询${game}角色失败 retcode:${r?.retcode ?? "-"}(${r?.message || "接口无响应"})`)
      }
    }
    // 接口查不到角色时，用数据库里 bing 之后写入的 uid 兜底，
    // 避免「绑定成功但 sk 没落盘」导致 #更新抽卡记录/#体力 全部失效
    if (!list.length) {
      try {
        const MysUser = (await import(`file://${_path}/plugins/genshin/model/mys/MysUser.js`)).default
        const mu = await MysUser.create(Number(stuid))
        const games = { gs: false, sr: true, zzz: true }
        for (const [ game, isSr ] of Object.entries(games)) {
          for (const uid of mu?.getUids?.(game) || []) {
            list.push({ game_uid: uid, region: utils.getServer(uid, isSr), region_name: "" })
          }
        }
        if (list.length) {
          Bot.logger.mark(`[扫码登录] 接口未返回角色，改用数据库记录兜底 角色数:${list.length}`)
        }
      } catch (err) {
        Bot.logger.warn(`[扫码登录] 数据库兜底读取角色失败：${err.message}`)
      }
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
        ltoken: ckMap?.get("ltoken") || sk?.get("ltoken") || "",
        mid: sk?.get("mid"),
        uid,
        userId: e.user_id,
        is_sign: true,
        region_name: s.region_name || "",
        region: s.region
      }
    }
    await gsCfg.saveBingStoken(e.user_id, allData)
    Bot.logger.mark(`[扫码登录] sk 写入完成 qq:${e.user_id} 角色数:${Object.keys(allData).length}`)
  } catch (err) {
    Bot.logger.error(`[扫码登录] 写入 sk 存储异常：${err.message}`)
  }
}
