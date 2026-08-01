/*
* 请勿直接修改此文件，可能会导致后续更新冲突
* 如需自定义可将文件复制一份，重命名为 help-cfg.js 后编辑
* */

export const helpCfg = {
  title: "逍遥帮助",
  subTitle: "Yunzai-Bot & xiaoyao-cvs-Plugin"
}

export const helpList = [
  {
    group: "信息查询",
    list: [
      {
        icon: 14,
        title: "#体力",
        desc: "重写原有的查询当前米游社体力"
      },
      {
        icon: 61,
        title: "#米游币查询",
        desc: "查询米游社账号米游币余额"
      },
      {
        icon: 66,
        title: "#**在哪里",
        desc: "原神地图资源点查询"
      }
    ]
  },
  {
    group: "stoken功能",
    list: [
      {
        icon: 75,
        title: "#更新抽卡记录",
        desc: "（更新|获取） 抽卡记录"
      },
      {
        icon: 74,
        title: "#mys原神签到",
        desc: "社区米游币获取(由于有验证码大概会失败)"
      },
      {
        icon: 92,
        title: "#刷新ck",
        desc: "重置当前cookie"
      }
    ]
  },
  {
    group: "其他功能",
    list: [
      {
        icon: 77,
        title: "#云原神签到",
        desc: "云原神签到"
      },
      {
        icon: 78,
        title: "#崩坏三签到",
        desc: "其余模块签到支持（崩坏3|崩坏2|未定义）"
      }
    ]
  },
  {
    group: "管理命令，仅管理员可用",
    auth: "master",
    list: [
      {
        icon: 57,
        title: "#逍遥设置",
        desc: "例如#逍遥设置体力开启（关闭）"
      },
      {
        icon: 58,
        title: "#逍遥模板更新",
        desc: "用于获取最新的体力模板"
      },
      {
        icon: 60,
        title: "#逍遥插件更新",
        desc: "用于获取最新的插件包数据"
      }
    ]
  }
]
