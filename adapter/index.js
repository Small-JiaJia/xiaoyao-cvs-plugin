import plugin from "../../../lib/plugins/plugin.js"
import * as Apps from "../apps/index.js"
import { render } from "./render.js"
import { checkAuth, getMysApi } from "./mys.js"

export class atlas extends plugin {
  constructor(e) {
    let rule = { reg: ".+", fnc: "dispatch" }
    let event = e?.event || e?.sub_type
    super({
      name: "xiaoyao-cvs-plugin",
      desc: "逍遥插件",
      event: event === "poke" ? "notice.*.poke" : "message",
      priority: 50,
      rule: [ rule ]
    })
    Object.defineProperty(rule, "log", {
      get: () => !!this.isDispatch
    })
  }

  accept() {
    if (this.event === "notice.*.poke" && this.e.target_id === Bot.uin) {
      this.e.user_id = this.e.operator_id
      this.e.msg = "#poke#"
    }
    this.e.original_msg = this.e.original_msg || this.e.msg
  }

  async dispatch(e) {
    let msg = e.original_msg || ""
    if (!msg) return false

    e.checkAuth = async function(cfg) {
      return await checkAuth(e, cfg)
    }
    e.getMysApi = async function(cfg) {
      return await getMysApi(e, cfg)
    }
    msg = msg.replace(/#|＃/, "#").trim()
    for (let fn in Apps.rule) {
      let cfg = Apps.rule[fn]
      // eslint-disable-next-line import/namespace
      let handler = Apps[fn]
      if (handler && new RegExp(cfg.reg).test(msg)) {
        let ret = await handler(e, { render })
        if (ret === true) return true
      }
    }
    return false
  }
}
