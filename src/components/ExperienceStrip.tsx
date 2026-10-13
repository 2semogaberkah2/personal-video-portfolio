import { experience } from '../data/experience';

export default function ExperienceStrip() {
  return <section className="experience section-wrap" id="experience">
    <div className="section-heading">
      <div><span className="section-kicker">PENGALAMAN</span><h2>PROYEK & KERJA<span className="headline-mark">.</span></h2></div>
      <span className="section-count">01 — {String(experience.length).padStart(2, '0')}</span>
    </div>
    <div className="experience-list">{experience.map((item, i) => <article className="experience-row" key={item.name}>
      <span className="experience-number">{String(i + 1).padStart(2, '0')}</span><h3>{item.name}</h3><p>{item.detail}</p>
    </article>)}</div>
  </section>;
}
