import _ from "lodash"
import moment from "moment"

async function sleepAsync(sleepms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, sleepms)
  })
}

async function randomSleepAsync(end) {
  let sleep = 4 * 1000 + _.random((end || 5) * 1000)
  await sleepAsync(sleep)
}
function randomString(length, os = false) {
  let randomStr = ""
  for (let i = 0; i < length; i++) {
    randomStr += _.sample(os
      ? "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
      : "abcdefghijklmnopqrstuvwxyz0123456789")
  }
  return randomStr
}
async function redisDel(userId, type = "bbs") {
  return await redis.del(`xiaoyao:${type}:${userId}`)
}
async function redisGet(userId, type = "bbs") {
  return JSON.parse(await redis.get(`xiaoyao:${type}:${userId}`))
}
async function redisSet(userId = "all", type = "bbs", data, time = 0) {
  let dayTime = moment(Date.now()).add("days", 1).format("YYYY-MM-DD 00:00:00")
  let newdate = (new Date(dayTime).getTime() - new Date().getTime()) / 1000 // 获取隔天凌晨的时间差
  if (time !== 0) {
    newdate = time
  }
  return await redis.set(`xiaoyao:${type}:${userId}`, JSON.stringify(data), {
    EX: parseInt(newdate)
  })
}

/**
 * 发送私聊消息，仅给好友发送
 * @param user_id qq号
 * @param msg 消息
 */
async function relpyPrivate(userId, msg) {
  userId = Number(userId) || String(userId)
  let friend = Bot.fl.get(userId)
  if (friend) {
    Bot.logger.mark(`发送好友消息[${friend.nickname}](${userId})`)
    return await Bot.pickUser(userId).sendMsg(msg).catch((err) => {
      Bot.logger.mark(err)
    })
  }
}
async function replyMake(e, _msg, lenght) {
  const bot = e.bot || Bot
  let nickname = bot.nickname
  if (e.isGroup) {
    if (bot.getGroupMemberInfo) {
      try {
        let info = await bot.getGroupMemberInfo(e.group_id, bot.uin)
        nickname = info.card || info.nickname
      } catch {}
    }
  }
  let msgList = []
  for (let [ index, item ] of Object.entries(_msg)) {
    if (index < lenght) {
      continue
    }
    msgList.push({
      message: item,
      nickname,
      user_id: bot.uin
    })
  }
  if (e.isGroup) {
    msgList = await e.group.makeForwardMsg(msgList)
  } else {
    msgList = await e.friend.makeForwardMsg(msgList)
  }
  if (e._reply) {
    e._reply(msgList)
  } else {
    e.reply(msgList)
  }
}

function getServer(uid, isSr = false) {
  switch (String(uid).slice(0, -8)) {
    case "1":
    case "2":
      return isSr ? "prod_gf_cn" : "cn_gf01" // 官服
    case "5":
      return isSr ? "prod_qd_cn" : "cn_qd01" // B服
    case "6":
      return isSr ? "prod_official_usa" : "os_usa" // 美服
    case "7":
      return isSr ? "prod_official_euro" : "os_euro" // 欧服
    case "8":
    case "18":
      return isSr ? "prod_official_asia" : "os_asia" // 亚服
    case "9":
      return isSr ? "prod_official_cht" : "os_cht" // 港澳台服
  }
  return isSr ? "prod_gf_cn" : "cn_gf01"
}
async function getCookieMap(cookie) {
  let cookieArray = cookie.replace(/\s*/g, "").split(";")
  let cookieMap = new Map()
  for (let item of cookieArray) {
    let entry = item.replace("=", "~").split("~")
    if (!entry[0]) continue
    cookieMap.set(entry[0], entry[1])
  }
  return cookieMap || {}
}
/**
 *
 * @param {e} e
 * @param {撤回的消息id} r
 * @param {多久撤回(秒)} times
 */
function recallMsg(e, r, times) {
  setTimeout(() => {
    if (e?.group?.recallMsg && r?.message_id) {
      e?.group?.recallMsg(r?.message_id)
    } else if (e?.friend?.recallMsg && r?.message_id) {
      e?.friend?.recallMsg(r?.message_id)
    }
  }, 1000 * times)
}

/**
 * 从二维码地址中安全解析 ticket
 * @param url 二维码地址
 * @returns ticket，解析失败返回空字符串
 */
function parseTicket(url) {
  try {
    return new URL(url).searchParams.get("ticket") || ""
  } catch {
    return ""
  }
}

/**
 * 脱敏账号id，仅保留首尾各两位
 * @param id 账号id
 */
function maskId(id) {
  let str = String(id ?? "")
  if (str.length <= 4) return "****"
  return `${str.slice(0, 2)}****${str.slice(-2)}`
}

export default {
  sleepAsync,
  redisDel,
  getServer,
  randomSleepAsync,
  replyMake,
  randomString,
  redisGet,
  redisSet,
  recallMsg,
  relpyPrivate,
  getCookieMap,
  parseTicket,
  maskId
}
