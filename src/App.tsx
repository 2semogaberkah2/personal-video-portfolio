import Navbar from './components/Navbar';
import Hero from './components/Hero';
import VideoFeed from './components/VideoFeed';
import ExperienceStrip from './components/ExperienceStrip';
import ContactSection from './components/ContactSection';
import Footer from './components/Footer';
import { siteConfig } from './config/siteConfig';
import AdminPanel from './admin/AdminPanel';
import './styles/admin.css';
export default function App() {
 if (window.location.pathname.replace(/\/$/, '') === '/admin') return <AdminPanel />;
 return <><Navbar/><main><Hero/><VideoFeed/><section className="intro section-wrap"><span className="section-kicker">TENTANG SAYA</span><h2>IDE, PRODUKSI,<br/>SAMPAI EDITING<span className="headline-mark">.</span></h2><p>{siteConfig.introduction}<br/><br/><strong>{siteConfig.location}</strong> · {siteConfig.professionalTitle}</p></section><ExperienceStrip/><ContactSection/></main><Footer/></>;
}
