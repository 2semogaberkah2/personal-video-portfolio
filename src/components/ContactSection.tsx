import { ArrowUpRight } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';

export default function ContactSection() {
  return <section className="contact section-wrap" id="contact">
    <span className="section-kicker">KONTAK</span>
    <h2>PUNYA PROYEK<br />VIDEO? <span>NGOBROL, YUK.</span></h2>
    <div className="contact-bottom">
      <p>Kalau kamu butuh video editor atau bantuan membuat konten pendek untuk brand, hubungi saya.</p>
      <a className="contact-cta" href={siteConfig.whatsappUrl || `mailto:${siteConfig.email}`}>HUBUNGI HAFID <ArrowUpRight size={17} /></a>
    </div>
    <p className="contact-note"><a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> · {siteConfig.phone} · {siteConfig.location}</p>
  </section>;
}
