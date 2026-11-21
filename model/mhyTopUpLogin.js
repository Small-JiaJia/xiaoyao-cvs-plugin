import User from "./user.js"
import utils from "./mys/utils.js"

const TOKEN_KINDS = { stoken: 1, stoken_v2: 1, ltoken: 2, ltoken_v2: 2, cookie_token: 4 }

export default class mysTopLogin {
  constructor(e) {
    this.e = e
    this.init()
    // 消息提示以及风险警告
    this.sendMsgUser = "免责声明:您将通过扫码完成获取米游社sk以及ck。\n本Bot将不会保存您的登录状态。\n我方仅提供米游社查询及相关游戏内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码~"
    this.sendMsgUserPassLogin = "免责声明:您将通过密码完成获取米游社sk以及ck。\n本Bot将不会保存您的账号和密码。\n我方仅提供米游社查询及相关游戏内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿发送账号密码~"
  }

  async init() {
    this.user = new User(this.e)
  }

  //
  async qrCodeLogin() {
    let RedisData = await utils.redisGet(this.e.user_id, "GetQrCode")
    if (RedisData?.image) {
      RedisData.image.file = Buffer.from(RedisData.image.file)
      this.e.reply([ "请扫码以完成绑定\n", RedisData.image ], false, { at: true, recallMsg: 60 })
      return false
    }
    // 新版通行证接口不再需要 device 参数
    let res = await this.user.getData("qrCodeLogin", {}, false)
    if (!res?.data?.url) {
      Bot.logger.error(`[扫码登录] 二维码获取失败 retcode:${res?.retcode} msg:${res?.message}`)
      return false
    }
    res.data.ticket = res.data.ticket || utils.parseTicket(res.data.url)
    if (!res.data.ticket) {
      Bot.logger.error("[扫码登录] 二维码地址中未解析到 ticket")
      return false
    }
    return res
  }

  /** 从 tokens 数组中按优先级取出指定 token */
  pickToken(tokens = [], names = []) {
    if (!Array.isArray(tokens)) return false
    for (const name of names) {
      const token = tokens.find(item => item?.token && (item.name === name || Number(item.token_type) === TOKEN_KINDS[name]))
      if (token) return token
    }
    return false
  }

  async GetQrCode(ticket) {
    if (!ticket) return false
    let res
    let RedisData = await utils.redisGet(this.e.user_id, "GetQrCode")
    for (let n = 1; n < 60; n++) {
      await utils.sleepAsync(5000)
      res = await this.user.getData("qrCodeQuery", { ticket }, false)
      if (res?.retcode && res.retcode != 0) {
        await utils.redisDel(this.e.user_id, "GetQrCode")
        await this.e.reply(res?.message || "二维码已过期", true)
        return false
      }
      // 新接口用 status，旧接口用 stat，兼容两者
      const status = res?.data?.status || res?.data?.stat
      if (status == "Scanned" && RedisData?.GetQrCode == 1) {
        Bot.logger.mark(`[扫码登录] 状态:Scanned retcode:${res?.retcode}`)
        await this.e.reply("二维码已扫描，请确认登录", true)
        RedisData.GetQrCode++
      }
      if (status == "Confirmed") {
        Bot.logger.mark(`[扫码登录] 状态:Confirmed retcode:${res?.retcode}`)
        break
      }
    }
    await utils.redisDel(this.e.user_id, "GetQrCode")
    if ((res?.data?.status || res?.data?.stat) != "Confirmed") {
      await this.e.reply("验证超时", true)
      return false
    }

    const stoken = this.pickToken(res.data?.tokens, [ "stoken_v2", "stoken" ])?.token
    const stuid = res.data?.user_info?.aid || res.data?.user_info?.uid || res.data?.user_info?.account_id
    const mid = res.data?.user_info?.mid
    if (!stoken || !stuid) {
      Bot.logger.error(`[扫码登录] 返回信息不完整 retcode:${res?.retcode}`)
      await this.e.reply("扫码登录返回信息不完整，未能获取stoken", true)
      return false
    }

    const stokenCookie = [ `stuid=${stuid}`, `stoken=${stoken}`, mid ? `mid=${mid}` : "" ].filter(Boolean).join(";") + ";"
    let ltoken = this.pickToken(res.data?.tokens, [ "ltoken", "ltoken_v2" ])?.token
    if (!ltoken) {
      const ltokenRes = await this.user.getData("getLtoken", { cookies: stokenCookie }, false)
      if (ltokenRes?.retcode === 0) ltoken = ltokenRes.data?.ltoken || ltokenRes.data?.token?.token
      if (!ltoken) {
        Bot.logger.error(`[扫码登录] 换取ltoken失败 retcode:${ltokenRes?.retcode}`)
        await this.e.reply(`获取ltoken失败：${ltokenRes?.message || "接口返回为空"}`, true)
        return false
      }
    }

    const ck = await this.user.getData("bbsGetCookie", { cookies: stokenCookie }, false)
    const cookieToken = ck?.data?.cookie_token
    if (!cookieToken) {
      Bot.logger.error(`[扫码登录] 换取ck失败 ck_retcode:${ck?.retcode}`)
      await this.e.reply(`获取ck失败：${ck?.message || "接口返回为空"}`, true)
      return false
    }

    Bot.logger.mark(`[扫码登录] 凭据获取成功 aid:${utils.maskId(stuid)}`)
    return {
      cookie: `ltoken=${ltoken};ltuid=${stuid};cookie_token=${cookieToken};account_id=${stuid};`,
      stoken: `stoken=${stoken};stuid=${stuid};ltoken=${ltoken};${mid ? `mid=${mid};` : ""}`
    }
  }

  async UserPassMsg() {
    this.e.reply(this.sendMsgUserPassLogin)
    this.e.reply("请将账号密码用逗号隔开私聊发送以完成绑定\n例：账号xxx@qq.com,密码xxxxx")
  }

  async UserPassLogin() {
    let msg = this.e.msg.replace(/账号|密码|：|:/g, "").replace(/,|，/, ",").split(",")
    if (msg.length != 2) {
      return false
    }
    let body = {
      account: msg[0], password: msg[1]
    }
    let res = await this.user.getData("loginByPassword", body, "")
    Bot.logger.mark(`[米哈游登录] retcode:${res?.retcode}`)
    if (res.retcode == -3101) {
      Bot.logger.mark("[米哈游登录] 正在验证")
      this.aigis_captcha_data = JSON.parse(res.aigis_data.data)
      let vlData = await this.crack_geetest()
      // let validate = await this.user.getData("validate", this.aigis_captcha_data, false)
      if (vlData?.data?.geetest_seccode) {
        Bot.logger.mark("[米哈游登录] 验证成功")
      } else {
        Bot.logger.error("[米哈游登录] 验证失败")
        this.e.reply("接口效验失败，请重新尝试~")
        return false
      }
      let validate = vlData?.data?.geetest_seccode.replace("|jordan", "")
      let aigis = res.aigis_data.session_id + ";" + Buffer.from(JSON.stringify({
        geetest_challenge: vlData?.data?.geetest_challenge,
        geetest_seccode: validate + "|jordan",
        geetest_validate: validate
      })).toString("base64")
      body.headers = {
        "x-rpc-aigis": aigis
      }
      res = await this.user.getData("loginByPassword", body, false)
      Bot.logger.mark(`[米哈游登录] retcode:${res?.retcode}`)
    }
    if (res.retcode == 0) {
      const stoken = res.data?.token?.token
      const info = res.data?.user_info || {}
      const stuid = info.aid || info.uid || info.account_id
      if (!stoken || !stuid) {
        await this.e.reply("登录返回信息不完整，未能获取stoken", true)
        return false
      }
      const cookies = `stuid=${stuid};stoken=${stoken};${info.mid ? `mid=${info.mid};` : ""}`
      const ck = await this.user.getData("bbsGetCookie", { cookies }, false)
      const lt = await this.user.getData("getLtoken", { cookies }, false)
      const cookieToken = ck?.data?.cookie_token
      const ltoken = lt?.data?.ltoken || lt?.data?.token?.token
      if (!cookieToken || !ltoken) {
        Bot.logger.error(`[米哈游登录] 换取ck失败 ck_retcode:${ck?.retcode} lt_retcode:${lt?.retcode}`)
        await this.e.reply(`获取ck失败：${ck?.message || lt?.message || "接口返回为空"}`, true)
        return false
      }
      Bot.logger.mark(`[米哈游登录] 凭据获取成功 aid:${utils.maskId(stuid)}`)
      return {
        cookie: `ltoken=${ltoken};ltuid=${stuid};cookie_token=${cookieToken};account_id=${stuid};`,
        stoken: cookies
      }
    } else {
      await this.e.reply(`登录失败：${res?.message || "未知错误"}(retcode:${res?.retcode})`, true)
      return false
    }
  }

  async crack_geetest() {
    let res = "" // await this.user.getData("microgg", this.aigis_captcha_data, false)
    // Bot.logger.mark(`[米哈游登录] ${Bot.logger.mark(JSON.stringify(res))}`)
    await this.e.reply(`请完成验证：https://challenge.minigg.cn/manual/index.html?gt=${this.aigis_captcha_data.gt}&challenge=${this.aigis_captcha_data.challenge}`, true)
    for (let n = 1; n < 60; n++) {
      await utils.sleepAsync(5000)
      try {
        res = await this.user.getData("microggVl", this.aigis_captcha_data, false)
        if (res?.data?.geetest_seccode) {
          return res
        }
      } catch (err) {
        Bot.logger.error(`[米哈游登录] 错误：${Bot.logger.red(err)}`)
      }
    }
    await this.e.reply("验证超时", true)
    return false
  }
}
