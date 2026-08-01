import { Cfg } from "./components/index.js"

/**
 *  支持锅巴
 *  锅巴插件：https://gitee.com/guoba-yunzai/guoba-plugin.git
 */

export function supportGuoba() {
  return {
    pluginInfo: {
      name: "xiaoyao-cvs-plugin",
      title: "xiaoyao-cvs-Plugin",
      author: "@逍遥 @cvs",
      authorLink: "https://gitee.com/Ctrlcvs",
      link: "https://gitee.com/Ctrlcvs/xiaoyao-cvs-plugin",
      isV3: true,
      isV2: true,
      description: "主要提供米游社签到、米游币、体力查询等功能",
      icon: "mdi:stove",
      iconColor: "#6bb9dd"
    },
    configInfo: {
      schemas: [
        {
          field: "sys.help",
          label: "默认帮助",
          bottomHelpMessage: "使用逍遥插件帮助为默认帮助",
          component: "Switch"
        },
        {
          field: "sys.Note",
          label: "体力",
          bottomHelpMessage: "使用逍遥插件体力为默认体力",
          component: "Switch"
        },
        {
          field: "mb.len",
          label: "体力模板",
          bottomHelpMessage: "体力模板类型",
          component: "Select",
          componentProps: {
            options: [
              { label: "随机", value: "0" },
              { label: "正方形模板", value: "1" },
              { label: "长方形模板", value: "2" }
            ],
            placeholder: "请选择体力模板类型"
          }
        }
      ],
      getConfigData() {
        return Cfg.merged()
      },
      setConfigData(data, { Result }) {
        for (let [ keyPath, value ] of Object.entries(data)) {
          Cfg.set(keyPath, value)
        }
        return Result.ok({}, "保存成功~")
      }
    }
  }
}
