import { ArrowUpRight } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';

export default function Navbar() {
  return <header className="navbar">
    <a className="wordmark" href="#top" aria-label={`${siteConfig.displayName}, ke atas`}>HAFID PORTOFOLIO<span className="wordmark-dot">.</span></a>
    <span className="nav-role">VIDEO EDITOR <i /> CONTENT CREATOR</span>
    <a className="nav-contact" href="#contact">KONTAK <ArrowUpRight size={15} /></a>
  </header>;
}
