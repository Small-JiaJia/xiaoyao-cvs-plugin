import fs from "fs"
import { exec } from "child_process"
import lodash from "lodash"
import { Cfg } from "../components/index.js"
import Common from "../components/Common.js"

let cfgMap = {
  "体力": "sys.Note",
  "帮助": "sys.help",
  "戳一戳": "note.poke",
  "模板": "mb.len",
  "获取sk": "ck.sk",
  "扫码绑定": "mhy.qrcode"
}
let sysCfgReg = `^#(逍遥|图鉴)设置\\s*(${lodash.keys(cfgMap).join("|")})?\\s*(.*)$`

export const rule = {
  updateMiaoPlugin: {
    hashMark: true,
    reg: "^#(逍遥|图鉴)插件(强制)?更新",
    describe: "【#管理】插件更新"
  },
  updateTemp: {
    hashMark: true,
    reg: "^#(逍遥|图鉴)模板(强制)?更新$",
    describe: "【#管理】更新体力模板"
  },
  sysCfg: {
    hashMark: true,
    reg: sysCfgReg,
    describe: "【#管理】系统设置"
  }
}

const _path = process.cwd()
const resPath = `${_path}/plugins/xiaoyao-cvs-plugin/resources/`
const notePlus = `${resPath}/BJT-Templet/`

export async function sysCfg(e, { render }) {
  if (!await checkAuth(e)) return true

  let cfgReg = new RegExp(sysCfgReg)
  let regRet = cfgReg.exec(e.msg)
  if (!regRet) return true

  if (regRet[2]) {
    let val = regRet[3] || ""
    let cfgKey = cfgMap[regRet[2]]

    if (cfgKey === "sys.scale") {
      val = Math.min(200, Math.max(50, val * 1 || 100))
    } else if (cfgKey === "mb.len") {
      val = Math.min(2, Math.max(val, 0))
    } else if (cfgKey === "mhy.qrcode") {
      val = Math.min(3, Math.max(val, 0))
    } else {
      val = !/关闭/.test(val)
    }

    if (cfgKey) Cfg.set(cfgKey, val)
  }

  let cfg = {
    help: getStatus("sys.help", false),
    Note: getStatus("sys.Note", false),
    len: Cfg.get("mb.len", 0),
    poke: getStatus("note.poke", false),
    isSk: getStatus("ck.sk", false),
    qrcode: Cfg.get("mhy.qrcode", 0),
    notePlus: fs.existsSync(notePlus),
    bg: await rodom()
  }

  return await Common.render("admin/index", { ...cfg }, { e, render, scale: 1.4 })
}

const rodom = async function() {
  let image = fs.readdirSync(`${resPath}/admin/imgs/bg`)
  return image.length == 1 ? image[0] : image[lodash.random(0, image.length - 1)]
}

const checkAuth = async function(e) {
  return await e.checkAuth({
    auth: "master",
    replyMsg: "只有主人才能命令我哦~\n    (*/ω＼*)"
  })
}

const getStatus = function(rote, def = true) {
  if (Cfg.get(rote, def)) {
    return "<div class=\"cfg-status\" >已开启</div>"
  } else {
    return "<div class=\"cfg-status status-off\">已关闭</div>"
  }
}

let timer

export async function updateMiaoPlugin(e) {
  if (!await checkAuth(e)) return true
  let isForce = e.msg.includes("强制")
  let command = "git  pull"
  if (isForce) {
    command = "git  checkout . && git  pull"
    e.reply("正在执行强制更新操作，请稍等")
  } else {
    e.reply("正在执行更新操作，请稍等")
  }
  exec(command, { cwd: `${_path}/plugins/xiaoyao-cvs-plugin/` }, function(error, stdout) {
    if (/Already up[ -]to[ -]date/.test(stdout) || stdout.includes("最新")) {
      e.reply("目前已经是最新版逍遥插件了~")
      return true
    }
    if (error) {
      e.reply("逍遥插件更新失败！\nError code: " + error.code + "\n" + error.stack + "\n 请稍后重试。")
      return true
    }
    e.reply("逍遥插件更新成功，尝试重新启动Yunzai以应用更新...")
    timer && clearTimeout(timer)
    redis.set("xiaoyao:restart-msg", JSON.stringify({
      msg: "重启成功，新版逍遥插件已经生效",
      qq: e.user_id
    }), { EX: 30 })
    timer = setTimeout(function() {
      let restart = "npm run start"
      if (process.argv[1].includes("pm2")) restart = "npm run restart"
      exec(restart, function(err, out) {
        if (err) {
          e.reply("自动重启失败，请手动重启以应用新版逍遥插件。\nError code: " + err.code + "\n" + err.stack + "\n")
          Bot.logger.error(`重启失败\n${err.stack}`)
          return true
        } else if (out) {
          Bot.logger.mark("重启成功，运行已转为后台，查看日志请用命令：npm run log")
          Bot.logger.mark("停止后台运行命令：npm stop")
          process.exit()
        }
      })
    }, 1000)
  })
  return true
}

export async function updateTemp(e) {
  if (!await checkAuth(e)) return true
  let command = ""
  let url = `${resPath}/BJT-Templet/`
  if (fs.existsSync(url)) {
    e.reply("开始尝试更新，请耐心等待~")
    command = "git pull"
    if (e.msg.includes("强制")) {
      command = "git  checkout . && git  pull"
      e.reply("正在执行强制更新操作，请稍等")
    } else {
      e.reply("正在执行更新操作，请稍等")
    }
    exec(command, { cwd: url }, function(error, stdout) {
      if (/Already up to date/.test(stdout) || stdout.includes("最新")) {
        e.reply("目前所有模板都已经是最新了~")
        return true
      }
      let numRet = /(\d*) files changed,/.exec(stdout)
      if (numRet && numRet[1]) {
        e.reply(`报告主人，更新成功，此次更新了${numRet[1]}个文件~`)
        return true
      }
      if (error) {
        e.reply("更新失败！\nError code: " + error.code + "\n" + error.stack + "\n 请稍后重试。")
      } else {
        e.reply("体力扩展包更新成功~")
      }
    })
  } else {
    command = `git clone https://gitee.com/SmallK111407/BJT-Template.git "${url}"`
    e.reply("开始尝试安装体力扩展包，可能会需要一段时间，请耐心等待~")
    exec(command, function(error) {
      if (error) {
        e.reply("体力扩展包安装失败！\nError code: " + error.code + "\n" + error.stack + "\n 请稍后重试。")
      } else {
        e.reply("体力扩展包安装成功！您后续也可以通过 #逍遥模板更新 命令来更新模板")
      }
    })
  }
  return true
}
