import { useEffect, useRef } from 'react'
import { observeIn, unobserveIn } from '../lib/motion'
import Editable from './Editable'

/* 关于我：按用户截图版式实现
   1. 第一根横线上方：小标题「个人简介」（与下方「服务客户品牌一览」完全同字号/字体/颜色）
   2. 横线下方：左照片（缩小，左边缘与横线左端齐平）+ 右文字介绍（右边缘与横线右端齐平）
   3. 两根横线之间的上下间距按截图比例（横线→照片顶、内容底→下一个标题）
   文字全部为 Editable，可在后台（Shift+E）直接点改；也可改 fallback 文案固化 */
export default function About() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    observeIn(el)
    return () => unobserveIn(el)
  }, [])

  return (
    <main ref={ref} className="about">
      {/* 第一根横线上方：个人简介小标题 */}
      <p className="about__sec-label about__intro-label st" style={{ '--d': '0ms' }}>
        <Editable k="about-intro-label" fallback="个人简介" />
      </p>

      {/* 参考图版式：顶部横线（导航下方，跨越主体宽度 62vw） */}
      <div className="about__rule-top" aria-hidden="true" />

      <section className="about__profile">
        {/* 左：证件照 —— 缩小，左边缘与横线左端、LOGO 墙对齐 */}
        <div className="about__portrait">
          <img src="./portrait.jpg" alt="设计师肖像" />
        </div>

        {/* 右：文字介绍 —— 右边缘与横线右端齐平 */}
        <div className="about__bio">
          <p className="about__bio-name st" style={{ '--d': '90ms' }}>
            <Editable k="about-bio-name" fallback="冯嵘 | 1996.08.27" />
          </p>
          <p className="about__bio-text st" style={{ '--d': '160ms' }}>
            <Editable
              k="about-bio-skill"
              fallback="视觉设计师｜专注品牌视觉与文创包装，擅长品牌全案设计、产品包装、字体创意，重视视觉逻辑与落地效果，兼顾审美表达与商业需求。"
            />
          </p>
          <p className="about__bio-text st" style={{ '--d': '230ms' }}>
            <Editable k="about-bio-edu" fallback="2017 本科毕业于河南工业大学—电脑艺术设计专业" />
          </p>
          <p className="about__bio-text st" style={{ '--d': '300ms' }}>
            <Editable
              k="about-bio-career"
              fallback="2019–2026 任职于千和智汇品牌管理有限公司，担任视觉设计师，多年商业设计落地经验，服务多类烘焙、文创类项目，从概念构思、视觉创作到产品落地全程跟进，偏好国风、传统纹样类视觉表达，擅长把传统文化元素融入现代商业设计。"
            />
          </p>
        </div>
      </section>

      {/* 第二根横线上方：服务客户品牌一览（与「个人简介」同一样式） */}
      <p className="about__sec-label about__clients-title st" style={{ '--d': '380ms' }}>
        <Editable k="about-clients-label" fallback="服务客户品牌一览" />
      </p>
      <div className="about__rule-bottom" aria-hidden="true" />

      {/* 合作品牌 LOGO 墙 */}
      <div className="about__clients-wall">
        <img src="./brand-wall.png" alt="合作品牌" />
      </div>
    </main>
  )
}
