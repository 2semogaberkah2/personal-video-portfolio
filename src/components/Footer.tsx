import { siteConfig } from '../config/siteConfig';
export default function Footer() {
  return <footer className="footer"><a className="wordmark" href="#top">{siteConfig.displayName}<span className="wordmark-dot">.</span></a><span>{siteConfig.professionalTitle} · {siteConfig.location}</span><span>© {new Date().getFullYear()} {siteConfig.displayName}</span></footer>;
}
