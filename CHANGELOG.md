# 1.3.3
* 修复 `#更新抽卡记录` 报「authkey获取失败：登录状态失效」
    * 根因：`saveSkYaml` 里给 `user.cookie` 赋值对 `miHoYoApi` 无效（它读 `e.cookie`），
      扫码绑定后 `data/yaml/{qq}.yaml` 实际没写入，`genAuthKey` 拿不到 stoken+mid，固定返回 `-100`
    * `bindSkCK` 在 `bindStoken` 前后都显式设置 `e.cookie`，并把 cookie 里的 `ltoken` 合并进 sk 串
    * `getCookie` 只在真的读到值时覆盖 `e.cookie`，不再用 `undefined` 冲掉刚拿到的 ck
    * `saveSkYaml` 移到 `bing()` 之后执行；接口查不到角色时改用数据库已写入的角色 uid 兜底
    * `seachUid` 在 `exchange` 偶发失败时仍用扫码得到的 stoken/stuid 继续，避免整段写入被跳过
    * `authKey` 的 Cookie 头改为 `this.cookies || this.cookie`，不再发送 `undefined`
    * `#更新抽卡记录` 失败提示改为引导重新 `#扫码绑定`，不再误导成「cookie 过期」
    * `GetQrCode` / `UserPassLogin` 把首次 `exchange` 结果传给 `bindStoken` 复用
      （同一个 stoken 二次 exchange 会返回 `-3001 参数不合法`，此前靠兜底才没中断绑定）
# 1.3.2
* 修复 `#删除stoken` 只删 yaml、不删数据库的问题
    * 现象：删除后提示成功，但 `#签到` 仍能用旧凭据，`#体力` 却提示未绑定
    * 原因：`delSytk` 只操作 `data/yaml`，`data/db` 里 genshin 的 CK 未被清理
    * 现在先读出 ltuid → 删 yaml → 调用 `NoteUser.delMysUser()` 同步清理数据库
    * 修复 `delSytk` 中 `Object.keys(ck) == 0` 恒为 false，导致删空后残留空文件
    * 修复未指定 uid 时无法删除（原先必须 `ck[e.uid]` 存在才会继续）
* ltoken 严格取值，不再用 `cookie_token` 顶替
    * `seachUid` 与 `GetQrCode` 中 `ltoken` 只取真实 ltoken 值
    * 换取失败时留空并记录警告，避免语义混淆
* `#刷新ck` 修复与清理
    * 修复 `res` 为 `false` 时读 `res.message` 抛 `TypeError`
    * 移除未被使用的 `cookies` / `data` 死代码
# 1.3.1
* 新增 `BIND_GAMES` 常量，统一管理扫码绑定时查询的游戏列表
    * 修复 `#扫码登录` 漏查绝区零角色的问题
    * `model/user.js` 与 `apps/mhyTopUpLogin.js` 共用同一份配置，新增游戏只改一处
    * 游戏名在 `mys.boards` 中找不到时跳过并记录警告，不中断绑定
# 1.3.0
* 修复米游社 stoken 升级 v2 格式后 `#扫码登录` 失败（`retcode:1002`）
    * `exchange` 的 `src_token.token_type` 按 `v2_` 前缀自适应为 2
    * 改用两次 `exchange` 分别换取 `cookie_token` 与 `ltoken`，不再走只认 v1 的 `getLTokenBySToken`
    * 修复 `seachUid` 未同步 `this.cookie` 导致 `userGameInfo` 请求不带 Cookie
    * 修复 `userGameInfo` 传入无 `biz` 的 `ForumData` 导致 `game_biz=undefined`
    * 新增 `getBoard(name)`，从 `mys.boards` 取含 `biz` 的板块定义
    * `bindSkCK` 补写 `data/yaml/{qq}.yaml`，解决绑定成功但 `#体力` 仍提示未绑定 sk
    * `getLtoken` 改为 GET + Cookie 头，不再把凭据拼进 query
    * `saveBingStoken` 增加目录创建与写入异常处理，写入结果记入日志
    * 角色列表改为收集后一次性保存，避免循环内反复读写同一 yaml
# 1.2.9
* 增加星穹铁道武器、角色图鉴
    * 指令`#于夜色中图鉴`
    * 指令`#希儿图鉴`
    * 需要在设置中开启 指令：`#图鉴设置星铁图鉴开启`
    * 感谢****@小萌新****提供的部分数据
# 1.2.8
* 增加`#原神充值` 原神离线充值
* 增加`#商品列表`
* 增加`#订单查询` 
# 1.2.7
* 增加`#扫码登录`支持扫码获取sk以及ck
* 增加`#账号密码登录`支持获取sk以及ck
# 1.2.0 ~ 1.2.6
* 增加七圣召唤图鉴
    * 可通过`#七圣图鉴`获取可查询的目录数据
* 优化`stoken`绑定
* 优化别名文件
* 新增指令`多体力`
    * 用户可通过指令同时查询全部绑定的ck体力数据
* 新增`群体力推送`
    * 用户可通过`#开启、关闭体力推送` 来对体力推送进行操作
    * 管理员可通过`#体力设置群推送关闭、开启` 以及推送阈值设置`#体力设置群阈值120` 仅支持群操作
* 新增`#我的体力模板列表`
* 优化体力模板设置，支持多个设置、移除
* 新增`#图鉴模板更新`
    * 用于更新体力模板具体来源由**@SunRyK** **@地球生物** **@逍遥** 三位作者上传
    * 不会冲突已添加的模板数据，有需求可通过指令拉取
* 新增`#图鉴设置获取sk开启、关闭`
    * 绑定ck时自动获取sk
    * 风险自担！！！ 插件只负责提供功能
* 新增地图资源查询功能
    * `#月莲在哪里` 指令类似 `某某物品在哪里`
    * 感谢 **@小灰灰** 提供的webAPI接口服务
* 自动签到增加推送签到信息以及成功信息
* 新增指令`获取（抽卡记录|ck）` 导出cookie或者抽卡链接供用户操作到其他bot或app上面
* 增加国际服 `stoken` 绑定 (功能目前仅支持V3)
    * 支持国际服`刷新ck` 
* 新增指令 `#刷新ck`
    * 需要绑定`stoken`
    * 用于刷新登录失效的ck 
* 新增指令`#我的stoken|#我的云ck` 
* 新增操作发送`stoken`可以直接绑定
    * 具体格式 ****stuid=**********;stoken=**********;ltoken=**********;****
* 初步适配锅巴插件
* 新增指令`删除stoken|删除云(ck|token)`
# 1.1.9
* 新增指令`#更新抽卡记录`
    * 必须绑定stoken
    * 定义限制5分钟可请求一次避免刷屏`默认5分钟具体修改规则请自行修改config配置`
* 默认配置文件位于****xiaoyao-cvs-plugin/defSet/config/config.yaml****
    *后续叠加配置数据会在此文件中增加
* 新增指令`#ck查询`
* 可查询当前cookie绑定状态的签到信息以及米游币信息数据
* 新增指令`#米币查询`
* 新增`道具图鉴`图鉴数据
* 新增指令`#米游币全部签到`
    *为所有存在的stoken进行社区米游币签到
* 新增指令`#米社全部签到`
    *为所有用户进行其余的社区模块签到
* 新增自动签到默认**00:02**开始执行签到
    *具体时间修改在`./config/config.yaml`
* 米游社米游币获取功能需要绑定`cookies`来跑，非信任的bot请勿发送cookies
* 新增指令`cookies帮助`
* 新增指令`#米游社原神签到`
    * 用于获取米游社米游币
* 新增指令`#崩坏3签到`
    * 用于签到不同的社区模块
    * 具体有`原神、崩坏3、崩坏2、未定事件簿`
    * `大别野、崩坏星穹铁道、绝区零` 并未提供签到入口待定，后续概率补充
* 需要引入包文件`cnpm i promise-retry `跟`cnpm i superagent`
* V3版本引入文件`pnpm add promise-retry `跟`pnpm add superagent`
* 如果出现了安装其中一个包导致另外的包出问题的请群里询问
* 需要完整的cookie内容要包含`login_ticket`不然是无法实现米游社签到的
* 获取到的cookies发送bot后请触发一次`#mys原神签到`指令以保存`stoken`实现自动签到**（注：触发指令后无需多次获取cookies）**
* `stoken`文件数据在**xiaoyao-cvs-plugin/data/yaml/**目录下