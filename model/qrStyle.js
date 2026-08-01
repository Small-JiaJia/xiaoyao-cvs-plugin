import { encodeData, getTypeTable, QRPointType } from "simple-qrbtf"

/**
 * 逍遥专属二维码样式：数据点为相互连接的圆点，形成流体状块面
 *
 * 可扫描性的三条硬约束，改样式时不要破坏：
 * 1. 墨迹只出现在暗格内，且每个暗格中心必被覆盖 —— 扫描器按格心采样，故可无损解码
 * 2. 定位/校正/时序图案保持满格方块，不做艺术化处理，否则影响定位与透视校正
 * 3. 装饰边框画在静默区最外圈，内侧仍留 4 格空白
 */

const QUIET = 5
const LINK = 0.62

/** 定位、校正、时序图案必须严格满格 */
const SOLID_TYPES = new Set([
  QRPointType.POS_CENTER,
  QRPointType.POS_OTHER,
  QRPointType.ALIGN_CENTER,
  QRPointType.ALIGN_OTHER,
  QRPointType.TIMING
])

export function xiaoyaoQr(content, opt = {}) {
  const qrcode = encodeData({ text: content, correctLevel: "H" })
  if (!qrcode) return ""

  const fg = opt.fg || "#1d2540"
  const posColor = opt.posColor || "#d94f3d"
  const alignColor = opt.alignColor || "#3d7fd9"
  const size = opt.size || 500

  const table = getTypeTable(qrcode)
  const count = qrcode.getModuleCount()
  const total = count + QUIET * 2
  const isDark = (r, c) => r >= 0 && c >= 0 && r < count && c < count && qrcode.isDark(r, c)

  let dots = []
  let pos = []
  let align = []

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!isDark(r, c)) continue
      const type = table[r][c]
      const cx = c + QUIET + 0.5
      const cy = r + QUIET + 0.5

      if (SOLID_TYPES.has(type)) {
        const cell = `<rect x="${c + QUIET}" y="${r + QUIET}" width="1" height="1"/>`
        if (type === QRPointType.ALIGN_CENTER || type === QRPointType.ALIGN_OTHER) {
          align.push(cell)
        } else {
          pos.push(cell)
        }
        continue
      }

      dots.push(`<circle cx="${cx}" cy="${cy}" r="0.5"/>`)
      // 与右/下相邻暗格之间搭桥，墨迹始终落在两个暗格内部
      if (isDark(r, c + 1)) {
        dots.push(`<rect x="${cx}" y="${cy - LINK / 2}" width="1" height="${LINK}"/>`)
      }
      if (isDark(r + 1, c)) {
        dots.push(`<rect x="${cx - LINK / 2}" y="${cy}" width="${LINK}" height="1"/>`)
      }
    }
  }

  const inset = 0.75
  const frame = `<rect x="${inset}" y="${inset}" width="${total - inset * 2}" height="${total - inset * 2}" rx="2.5" fill="none" stroke="${posColor}" stroke-width="0.5" opacity="0.55"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="geometricPrecision">
  <rect width="${total}" height="${total}" fill="#ffffff"/>
  ${frame}
  <g fill="${fg}">${dots.join("")}</g>
  <g fill="${alignColor}">${align.join("")}</g>
  <g fill="${posColor}">${pos.join("")}</g>
</svg>`
}

export default xiaoyaoQr
