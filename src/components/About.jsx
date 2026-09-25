import { useEffect, useRef } from 'react'
import { observeIn, unobserveIn } from '../lib/motion'
import Editable from './Editable'

/* 关于我：按用户新参考图版式（7633×10606）实现首屏
   左：证件照（宽 24.5vw，占页面比例与参考图一致）
   右：7 行信息（从页宽 61.5% 起，宽 19.5vw，纵向 27%~100% 人像高）
   下方：合作品牌 LOGO 墙位置预留（仅标题，墙体后续添加）
   文字全部统一黑体、统一字重 */
export default function About() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    observeIn(el)
    return () => unobserveIn(el)
  }, [])

  return (
    <main ref={ref} className="about">
      {/* 参考图版式：顶部横线（导航下方，跨页宽 19%~81%） */}
      <div className="about__rule-top" aria-hidden="true" />
      <section className="about__profile">
        <div className="about__portrait">
          <img src="/portrait.jpg" alt="设计师肖像" />
        </div>
        <div className="about__p-info">
          <h2 className="about__name sq">
            <Editable k="about-name" fallback="冯嵘" />
          </h2>
          <p className="about__dob st" style={{ '--d': '90ms' }}>
            <Editable k="about-dob" fallback="1996.8.27" />
          </p>
          <p className="about__skill st" style={{ '--d': '160ms' }}>
            <Editable k="about-skill" fallback="擅长品牌设计、包装设计、字体设计" />
          </p>
          <p className="about__edu st" style={{ '--d': '230ms' }}>
            <Editable k="about-edu" fallback="2017年毕业于河南工业大学" />
          </p>
          <p className="about__edu-sub st" style={{ '--d': '300ms' }}>
            <Editable k="about-edu2" fallback="本科 电脑艺术设计" />
          </p>
          <p className="about__c-years st" style={{ '--d': '370ms' }}>
            <Editable k="about-career-years" fallback="2019年——2026年" />
          </p>
          <p className="about__c-role st" style={{ '--d': '430ms' }}>
            <Editable k="about-career-role" fallback="在千和智汇担任品牌设计师" />
          </p>
        </div>
      </section>

      {/* 合作品牌 LOGO 墙：位置预留，墙体后续添加 */}
      <section className="about__clients">
        <p className="about__clients-title st" style={{ '--d': '520ms' }}>
          <Editable k="about-clients" fallback="曾担任以下合作品牌 主创设计师" />
        </p>
        {/* 参考图版式：标题下方横线（LOGO 墙区域顶部） */}
        <div className="about__rule-bottom" aria-hidden="true" />
        <div className="about__clients-wall">
          <img src="/brand-wall.png" alt="合作品牌" />
        </div>
      </section>
    </main>
  )
}
