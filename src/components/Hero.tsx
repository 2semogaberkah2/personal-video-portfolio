import { ArrowDown } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="eyebrow"><span className="status-dot" /> PORTOFOLIO HAFID <span className="eyebrow-year">— 2026</span></div>
      <h1>VIDEO EDITOR <span className="amp">&</span><br />CONTENT CREATOR<span className="headline-mark">.</span></h1>
      <div className="hero-bottom">
        <p>{siteConfig.tagline}</p>
        <a href="#work" className="scroll-link">LIHAT KARYA <ArrowDown size={15} /></a>
      </div>
    </section>
  );
}
