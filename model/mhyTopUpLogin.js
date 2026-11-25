import User from "./user.js";
import utils from './mys/utils.js';
import Common from "../components/Common.js";
export default class mysTopLogin {
    constructor(e) {
        this.e = e;
        this.init();
        //消息提示以及风险警告
        this.sendMsgUser = `免责声明:您将通过扫码完成获取米游社sk以及ck。\n本Bot将不会保存您的登录状态。\n我方仅提供米游社查询及相关游戏内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码~`
        this.sendMsgPay = `格式参考：#原神充值 6(商品ID)\n可通过【#商品列表】获取可操作商品`
        this.sendMsgOrderReg = `消息格式无法识别，格式参考：#订单查询16347*****(订单号),100000000(uid)`
        this.keys = `xiaoyao:payOrder`
    }
    async init() {
        this.user = new User(this.e)
    }
    //
    async qrCodeLogin() {
        let RedisData = await utils.redisGet(this.e.user_id, "GetQrCode")
        if (RedisData) {
            this.e.reply([segment.at(this.e.user_id), `上一条二维码还在等待扫码，请先完成，或等待 5 分钟后再试`])
            return false;
        }
        this.device = await utils.randomString(16)
        this.e.reply(this.sendMsgUser)
        let res = await this.user.getData("qrCodeLogin", {
            device: this.device
        },false)
        // getData 在网络异常时返回 false，直接取 res.data 会抛 TypeError，
        // 用户那边表现成「发了指令毫无反应」，这里必须先判空
        if (!res?.data) {
            Bot.logger.error(`[扫码登录] 获取二维码失败 retcode:${res?.retcode ?? "-"}(${res?.message || "接口无响应"})`)
            await this.e.reply("获取二维码失败，请稍后重试~", true)
            return false;
        }
        res.data["ticket"] = res.data["ticket"] || res.data?.url?.split("ticket=")[1]
        if (!res.data["ticket"]) {
            Bot.logger.error("[扫码登录] 二维码返回中没有 ticket，无法轮询扫码状态")
            await this.e.reply("获取二维码失败，请稍后重试~", true)
            return false;
        }
        return res
    }
    async GetQrCode(ticket) {
        await utils.redisSet(this.e.user_id, "GetQrCode", { GetQrCode: 1 }, 60 * 5) //设置5分钟缓存避免重复触发
        let res;
        let RedisData = await utils.redisGet(this.e.user_id, "GetQrCode")
        for (let n = 1; n < 60; n++) {
            await utils.sleepAsync(5000)
            res = await this.user.getData("qrCodeQuery", {
                device: this.device, ticket
            },false)
            if (res?.data?.status == "Scanned" && RedisData.GetQrCode == 1) {
                Bot.logger.mark(JSON.stringify(res))
                await this.e.reply("二维码已扫描，请确认登录", true)
                RedisData.GetQrCode++;
            }
            if (res?.data?.status == "Confirmed") {
                Bot.logger.mark(JSON.stringify(res))
                break
            }
        }
        await utils.redisDel(this.e.user_id, 'GetQrCode')
        // tokens 为空数组时是真值，原来的 `!res.data.tokens && !user_info` 拦不住，
        // 会在下面取 user_info.aid 时抛 TypeError，这里改成判长度
        if (!res?.data?.tokens?.length || !res?.data?.user_info) {
            await this.e.reply("验证超时", true)
            return false
        }
        const uid = res.data.user_info.aid || res.data.user_info.uid || res.data.user_info.account_id
        const mid = res.data.user_info.mid
        // 接口返回的 tokens 里没有 name 字段（实测只有 token/token_type），
        // 优先按 token_type=1(stoken) 取，取不到再退回第一个
        const tokens = res.data.tokens || []
        const stokenItem = tokens.find(i => i?.name === "stoken" || i?.name === "stoken_v2") ||
            tokens.find(i => Number(i?.token_type) === 1) || tokens[0]
        let token = stokenItem?.token
         if (!(uid && token && mid)) {
            await this.e.reply("stoken获取不完整请重新扫码", true);
            return false
        }
        // src_token 始终按 stoken 传 1。接口虽然返回 {token_type:1}，但不要拿它当参数用——
        // 一旦某天返回 2，exchange 会把它当 ltoken 直接 -3001，扫码绑定就整条挂掉
        const tokenType = 1

        // 主接口：exchange（dst_token_type=4 换 cookie_token）
        let UserData = await this.user.getData("exchange", { token, mid, tokenType, dstTokenType: 4 }, false)
        let cookieToken = UserData?.data?.token?.token || UserData?.data?.cookie_token
        if (!cookieToken) {
            // 注意：不要回退到 bbsGetCookie，该接口只接受 v1 stoken，v2 token 必然返回 1002
            Bot.logger.error(`[扫码登录] exchange 换取 cookie_token 失败 retcode:${UserData?.retcode}(${UserData?.message || ""}) tokenType:${tokenType} mid:${mid}`)
            await this.e.reply(`换取cookie_token失败：${UserData?.message || "接口返回为空"}`, true)
            return false
        }

        // ltoken 同样通过 exchange 换取（dst_token_type=2）。
        // 不能用 getLTokenBySToken：该接口只接受 v1 stoken，v2_ token 会固定返回 1002
        const ltRes = await this.user.getData("exchange", { token, mid, tokenType, dstTokenType: 2 }, false)
        const ltoken = ltRes?.data?.token?.token || ltRes?.data?.ltoken
        if (!ltoken) {
            // 不再用 cookie_token 顶替：两者语义不同，填错会让后续按 ltoken 处理的逻辑出错
            Bot.logger.warn(`[扫码登录] exchange 换取 ltoken 失败 retcode:${ltRes?.retcode}(${ltRes?.message || ""})，ltoken 将留空`)
        }
        let stoken =`stoken=${token};stuid=${uid};mid=${mid}`
        return {
            cookie: `ltoken=${ltoken || ''};ltuid=${uid};cookie_token=${cookieToken};account_id=${uid};`,
            stoken,
            // 同一个 stoken 二次 exchange 会返回 -3001（token 已被消费），
            // 把首次结果带出去给 bindStoken 复用
            exchange: UserData
        }
    }

    async showgoods({ render }) {
        let goodslist = await this.goodsList()
        if (!goodslist) return false;
        // let msg = ['当前支持的商品有：\n']
        for (const [i, goods] of Object.entries(goodslist)) {
            if (i == 'api') continue;
            goods.num = `${goods['goods_name']} × ${(goods['goods_unit'] * 1 == 0 ? '1' : goods['goods_unit'])} ` + ((goods['goods_unit']) < 0 ? goods["goods_name"] : '')
            goods.index = i
        }
        return await Common.render(`pay/goods`, {
            goodslist
        }, {
            e: this.e,
            render,
            scale: 1.2,
        })
    }

    async GetCode({ render }) {
        try {
            let msg = this.e.msg.replace(/,|，|\|/g, ' ').split(' ')
            if (msg.length != 2) {
                this.e.reply(this.sendMsgPay)
                return true;
            }
            let iswx = msg[0].includes('微信') ? 'wechatpay' : 'alipay'
            if (msg[1].length != 1) {
                this.e.reply(this.sendMsgPay)
                return true;
            }
            let goods = (await this.goodsList())[msg[1]]
            if (!this.e.cookie) {
                this.e.reply('请先 #绑定cookie')
                return true;
            }
            let redisData = await utils.redisGet(this.e.uid, "payOrder")
            if (redisData) {
                this.e.reply(`uid:${this.e.uid},已有充值订单存在,请五分钟后再创建新充值订单`)
                return true
            }
            let ckData = await utils.getCookieMap(this.e.cookie)
            let device_id = utils.randomString(16)
            let region = utils.getServer(this.e.uid)
            let order = {
                "account": ckData?.get('ltuid') || ckData?.get('account_id'),
                "region": region,
                "uid": this.e.uid,
                "delivery_url": "",
                "device": device_id,
                "channel_id": 1,
                "client_ip": "",
                "client_type": 4,
                "game": this.e.uid[0] * 1 > 5 ? 'hk4e_global' : "hk4e_cn",
                "amount": goods.price,
                "goods_num": 1,
                "goods_id": goods?.goods_id,
                "goods_title": goods?.goods_name + (Number(goods.goods_unit) > 0 ? "×" + goods.goods_unit : ""),
                "price_tier": goods?.tier_id,
                "currency": "CNY",
                "pay_plat": iswx,
            }
            if (iswx != 'weixin') {
                order["pay_type"] = iswx
                order["pay_vendor"] = iswx
            }
            let res = await this.user.getData('createOrder', { order, headers: { "x-rpc-device_id": device_id } })
            if (!res) return false;
            if (res?.code != 200 && res?.retcode != 0) {
                this.e.reply('生成充值订单失败：' + res.message)
                return true
            }
            //记录操作日志
            logger.mark(`当前操作用户：${this.e.user_id},操作uid:${this.e.uid},操作商品id:${goods?.goods_id},操作商品：${goods?.goods_name + (Number(goods.goods_unit) > 0 ? "×" + goods.goods_unit : "")}`)
            logger.mark(`支付链接：${res['data']['encode_order']}\n订单号：${res['data']['order_no']}\n 价格：${(res['data']['amount']) / 100}元`)
            let r = await Common.render(`pay/index`, {
                url: res.data.encode_order,
                data: res.data, uid: this.e.uid,
                goods,
            }, {
                e: this.e,
                render,
                scale: 1.2, retMsgId: true
            })
            await utils.redisSet(this.e.uid, "payOrder", { uid: this.e.uid, oId: res?.data?.order_no, message_id: r.message_id, region }, 300)
            return true
        } catch (error) {
            console.log(error)
            this.e.reply('出问题了捏')
        }
        return true;
    }

    async goodsList() {
        let goods = await this.user.getData("goodsList")
        if (goods?.retcode != 0) {
            this.e.reply(goods.message)
            return false;
        }
        return goods?.data?.goods_list;
    }

    async GetPayData(key, value) {
        let keys = await redis.keys(`${this.keys}:*`)
        if (keys.length == 0) {
            return ''
        }
        let redisKays = await redis.mGet(keys)
        for (const i of redisKays) {
            let item = JSON.parse(i)
            if (item[key] == value) {
                return item
            }
        }
        return ''
    }

    async checkOrder() {
        try {
            let msg, data = await this.user.getCookie(this.e), redisData = await utils.redisGet(data.uid, "payOrder")
            if (this.e.source) {
                // 获取原消息
                let source
                if (this.e.isGroup) {
                    source = (await this.e.group.getChatHistory(this.e.source.seq, 1)).pop()
                } else {
                    source = (await this.e.friend.getChatHistory(this.e.source.time, 1)).pop()
                }
                if (source) {
                    redisData = await this.GetPayData('message_id', source.message_id)
                }
            } else {
                msg = this.e.msg.match(/\d{9,}/g)
                if (msg?.length == 2) {
                    let data;
                    if (msg[0].length > 9 && msg[1].length == 9) {
                        data = { uid: msg[1], oId: msg[0] }
                    } else if (msg[1].length > 9 && msg[0].length == 9) {
                        data = { uid: msg[0], oId: msg[1] }
                    } else {
                        this.e.reply(this.sendMsgOrderReg)
                        return true
                    }
                    redisData = data
                }
            }
            if (!redisData?.uid) {
                this.e.reply(`uid:${data.uid},未查询到充值订单`)
                return true
            }
            let res = await this.user.getData('checkOrder', {
                uid: redisData.uid, order_no: redisData.oId
            }, false)
            if (!res) return false;
            if (res?.data?.status == 1) {
                this.e.reply(`uid:${redisData.uid}\n商品:${res?.data?.goods_title} x ${res?.data?.goods_num}\n订单：${redisData.oId}等待支付中`)
            } else if (res?.data?.status == 999) {
                this.e.reply(`uid:${redisData.uid}\n商品:${res?.data?.goods_title} x ${res?.data?.goods_num}\n订单：${redisData.oId}已支付完成`)
            } else {
                this.e.reply(`订单：${redisData.oId},${res.message}`)
            }
            return true
        } catch (error) {
            console.log('查询订单异常',error)
            return true
        }

    }
}