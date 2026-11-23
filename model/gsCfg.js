import fs from "node:fs"
import { promisify } from "node:util"
import YAML from "yaml"
import lodash from "lodash"
import { isV3 } from "../components/Changelog.js"
const plugin = "xiaoyao-cvs-plugin"
/**
 * 配置文件
 * 主要用于处理 stoken以及云原神账号数据
 */
const _path = process.cwd()
class GsCfg {
  /** 通用yaml读取 */
  getfileYaml(path, name) {
    this.cpCfg("config", "config")
    return YAML.parse(
      fs.readFileSync(path + name + ".yaml", "utf8")
    )
  }

  cpCfg(app, name) {
    if (!fs.existsSync(`./plugins/${plugin}/config`)) fs.mkdirSync(`./plugins/${plugin}/config`)
    let set = `./plugins/${plugin}/config/${name}.yaml`
    if (!fs.existsSync(set)) fs.copyFileSync(`./plugins/${plugin}/defSet/${app}/${name}.yaml`, set)
  }

  async getMasterQQ() {
    let qq
    if (isV3) {
      let config = (await import(`file://${_path}/lib/config/config.js`)).default
      qq = config.masterQQ[0]
    } else {
      // eslint-disable-next-line no-undef
      qq = BotConfig.masterQQ[0]
    }
    return qq
  }

  /** 读取用户绑定的ck */
  async getBingCk() {
    let ck = {}
    let ckQQ = {}
    let dir = "./data/MysCookie/"
    let files = fs.readdirSync(dir).filter(file => file.endsWith(".yaml"))

    const readFile = promisify(fs.readFile)

    let promises = []

    files.forEach((v) => promises.push(readFile(`${dir}${v}`, "utf8")))

    const res = await Promise.all(promises)

    res.forEach((v) => {
      let tmp = YAML.parse(v)
      lodash.forEach(tmp, (v, i) => {
        ck[String(i)] = v
        if (v.isMain && !ckQQ[String(v.qq)]) {
          ckQQ[String(v.qq)] = v
        }
      })
    })

    return {
      ck,
      ckQQ
    }
  }

  /** 读取所有用户绑定的ck */
  async getBingAllCk() {
    let ck = {}
    let ckQQ = {}
    let qqCk = {}
    let dir = "./data/MysCookie/"
    let files = fs.readdirSync(dir).filter(file => file.endsWith(".yaml"))

    const readFile = promisify(fs.readFile)

    let promises = []

    files.forEach((v) => promises.push(readFile(`${dir}${v}`, "utf8")))

    const res = await Promise.all(promises)

    res.forEach((v) => {
      let tmp = YAML.parse(v)
      let qq
      lodash.forEach(tmp, (item, uid) => {
        qq = item.qq
        ck[String(uid)] = item
        if (!qqCk[String(item.qq)]) qqCk[String(item.qq)] = []
        qqCk[String(item.qq)].push(item)
        if (item.isMain && !ckQQ[String(item.qq)]) {
          ckQQ[String(item.qq)] = item
        }
      })
      if (qq && !ckQQ[String(qq)]) {
        ckQQ[String(qq)] = Object.values(tmp)[0]
      }
    })

    return { ck, ckQQ, qqCk }
  }

  async getUserStoken(userId) {
    try {
      let ck = YAML.parse(
        fs.readFileSync(`plugins/${plugin}/data/yaml/${userId}.yaml`, "utf8")
      )
      return ck || {}
    } catch (ex) {
      return {}
    }
  }

  /** 读取所有用户绑定的stoken */
  async getBingStoken() {
    let ck = []
    // let ckQQ = {}
    let dir = `plugins/${plugin}/data/yaml/`
    let files = fs.readdirSync(dir).filter(file => file.endsWith(".yaml"))

    const readFile = promisify(fs.readFile)

    let promises = []

    files.forEach((v) => promises.push(readFile(`${dir}${v}`, "utf8")))
    const res = await Promise.all(promises)
    res.forEach((v, index) => {
      let tmp = YAML.parse(v)
      ck.push(tmp)
    })
    return ck
  }

  getBingCkSingle(userId) {
    let file = `./data/MysCookie/${userId}.yaml`
    try {
      let ck = fs.readFileSync(file, "utf-8")
      ck = YAML.parse(ck)
      return ck
    } catch (error) {
      return {}
    }
  }

  getBingCookie(userId) {
    let file = `./data/MysCookie/${userId}.yaml`
    try {
      let ck = fs.readFileSync(file, "utf-8")
      ck = YAML.parse(ck)
      for (let item in ck) {
        let login_ticket
        if (!ck[item].isMain) {
          continue
        }
        login_ticket = ck[item]?.login_ticket
        ck = ck[item].ck
        return {
          ck,
          item,
          login_ticket
        }
      }
    } catch (error) {
      return {}
    }
  }

  /** 校验是否为合法游戏uid：纯数字且长度合理，排除 undefined / [object Object] / 占位符 1 等脏key */
  isValidUid(uid) {
    let str = String(uid ?? "").trim()
    return /^\d{6,12}$/.test(str)
  }

  saveBingStoken(userId, data) {
    const dir = `./plugins/${plugin}/data/yaml/`
    let file = `${dir}${userId}.yaml`
    if (lodash.isEmpty(data)) {
      fs.existsSync(file) && fs.unlinkSync(file)
      return
    }
    // 目录不存在时先创建，否则 writeFileSync 会直接抛异常导致整个绑定流程中断
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    } catch (error) {
      Bot.logger.error(`[stoken保存] 创建目录失败 ${dir}：${error.message}`)
      return
    }
    // 过滤掉非法uid，避免写入 undefined / [object Object] / "1" 这类脏数据
    let clean = {}
    for (let [ uid, item ] of Object.entries(data)) {
      if (!this.isValidUid(uid)) {
        Bot.logger.debug(`[stoken保存] 跳过非法uid:${uid} (qq:${userId})`)
        continue
      }
      clean[uid] = item
    }
    if (lodash.isEmpty(clean)) return
    let ck = {}
    if (fs.existsSync(file)) {
      try {
        ck = YAML.parse(fs.readFileSync(file, "utf-8")) || {}
      } catch (error) {
        Bot.logger.error(`[stoken保存] 读取 ${userId}.yaml 失败，将重建：${error.message}`)
        ck = {}
      }
    }
    // 旧格式（单uid平铺）直接覆盖为新格式
    if (ck.uid) ck = {}
    // 顺带清理历史遗留的非法key
    for (let uid of Object.keys(ck)) {
      if (!this.isValidUid(uid)) delete ck[uid]
    }
    Object.assign(ck, clean)
    // 先写临时文件再重命名，避免中断产生半截文件
    let tmp = `${file}.tmp`
    try {
      fs.writeFileSync(tmp, YAML.stringify(ck), "utf8")
      fs.renameSync(tmp, file)
      Bot.logger.mark(`[stoken保存] 已写入 ${file}`)
    } catch (error) {
      Bot.logger.error(`[stoken保存] 写入 ${file} 失败：${error.message}`)
    }
  }
}

export default new GsCfg()
