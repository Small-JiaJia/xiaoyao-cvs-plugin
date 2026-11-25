# xiaoyao-cvs-plugin

yunzai-bot 扩展插件，提供米游社签到、米游币、体力查询等功能

项目仅供学习交流使用，严禁用于任何商业用途和非法行为

## 介绍

逍遥插件为 Yunzai-Bot 提供米游社相关功能支持。

## 本地修改说明

> 本 fork 在原版基础上修复了 **米游社 stoken 升级为 v2 格式后 `#扫码登录` 失败** 的问题。
> 若你从原仓库更新代码，以下改动会被覆盖，需要重新合并。

### 问题背景

米游社改版后，扫码登录 `queryQRLoginStatus` 返回的 token 从 v1（纯字母数字）变为
**v2 格式**（`v2_xxx==.CAE=`，`token_type: 1`）。原版调用链因此全部失效：

| 环节 | 原版做法 | 失败原因 |
| --- | --- | --- |
| 换 CK | `getCookieAccountInfoBySToken` | 该接口只接受 v1 stoken，v2 会返回 `1002` |
| 换 ltoken | `getLTokenBySToken` | 同上，另有成对方法 `getLTokenBySTokenV1` 可佐证 v1/v2 分离 |
| ltoken 取值 | `ltoken=${token}` 直接把 stoken 当 ltoken | v1 时代碰巧可用，v2 下彻底不可用 |

## 功能特性

- stoken 相关功能支持
- 云原神签到支持
- 扫码登录
- 体力查询与推送
- 米游币查询与任务
- 抽卡记录更新

## 安装教程

使用 github：
```
git clone https://github.com/Small-JiaJia/xiaoyao-cvs-plugin.git ./plugins/xiaoyao-cvs-plugin/
```

## 使用说明

配合云崽使用：https://gitee.com/Le-niao/Yunzai-Bot

配合喵崽使用：https://gitee.com/yoimiya-kokomi/Miao-Yunzai.git

## 命令说明

1. 发送 `#逍遥帮助` 获取帮助面板
2. 发送 `#逍遥设置` 获取管理面板
3. 发送 `#逍遥版本` 获取更新日志
4. 发送 `#逍遥插件更新` 获取最新代码
5. 发送 `#扫码登录` 扫码绑定米游社账号（获取 sk 与 ck，群聊/私聊均可，取决于配置）
6. 发送 `#体力` 查询当前米游社体力
7. 发送 `#刷新ck` 刷新失效的 cookie
8. 发送 `#崩坏3签到` 可签到崩坏3游戏模块，具体支持【崩坏3、原神、崩坏2、未定义事件】
9. 发送 `#云原神签到` 可签到云原神游戏
10. 支持 stoken 绑定以及相关的操作，如 `#更新抽卡记录`
11. 默认配置文件位于 `./plugins/xiaoyao-cvs-plugin/defSet/config/config.yaml`

## 后续计划

关于插件兼容以及支持问题：

由于喵崽目前 uid 以及 ck 管理部分正在重写，盲目兼容只会不断的进行修改以及完善，如非必要情况可以先不急更新主体

画个大饼，等随缘咕咕咕

## 其他

- [爱发电](https://afdian.net/a/Ctrlcvs)
- 最后再求个 star，你的支持是维护本项目的动力~~
- 素材来源于网络，仅供交流学习使用
- 严禁用于任何商业用途和非法行为
- Yunzai-Bot 官方 QQ 群：213938015（暂时停止新加入）
- 喵喵 Miao-Plugin QQ 群：755269874（暂时停止新加入）
- 闲聊群 342996701

## 致谢

| [xiaoyao-cvs-plugin](https://github.com/Ctrlcvs/xiaoyao-cvs-plugin) | 原项目作者 [@ctrlcvs](https://github.com/Ctrlcvs)| 
| [xiaoyao-cvs-plugin](https://gitee.com/qsyhh/xiaoyao-cvs-plugin) | 热心二改作者 [@qsyhh](https://gitee.com/qsyhh)| 