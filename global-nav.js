// Global Navigation - closermethod
// Add <script src="/global-nav.js" defer></script> to any page
(function(){
// Skip if nav already exists or if page opts out
if(document.getElementById('cmNav'))return;
if(document.body.getAttribute('data-no-nav')==='true')return;

// === TAX SEASON BANNER ===
var bannerStyle=document.createElement('style');
bannerStyle.textContent=`
.cm-tax-banner{position:fixed;top:0;left:0;right:0;z-index:1001;background:linear-gradient(90deg,#1a0000,#2a0000,#1a0000);border-bottom:1px solid rgba(255,68,68,0.4);padding:8px 20px;text-align:center;font-family:'DM Sans',sans-serif}
.cm-tax-banner-inner{display:flex;align-items:center;justify-content:center;gap:10px;max-width:900px;margin:0 auto}
.cm-tax-banner-text{font-size:12px;font-weight:600;color:#ff4444}
.cm-tax-banner-text strong{color:#fff}
.cm-tax-banner-text s{color:#666;font-weight:400}
.cm-tax-banner-timer{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#ff4444;white-space:nowrap}
.cm-tax-banner-cta{font-size:11px;font-weight:700;color:#fff;background:#ff4444;padding:4px 12px;border-radius:4px;text-decoration:none;white-space:nowrap;flex-shrink:0}
.cm-tax-banner-cta:hover{background:#ff6666}
@media(max-width:600px){.cm-tax-banner{padding:6px 12px}.cm-tax-banner-inner{flex-wrap:wrap;gap:6px}.cm-tax-banner-text{font-size:11px;width:100%}.cm-tax-banner-timer{font-size:11px}.cm-tax-banner-cta{font-size:11px;padding:4px 10px}}
`;
document.head.appendChild(bannerStyle);

var banner=document.createElement('div');
banner.className='cm-tax-banner';
banner.id='cmTaxBanner';
banner.innerHTML=`<div class="cm-tax-banner-inner">
<span class="cm-tax-banner-text">TAX SALE: Kit <strong>$247</strong> <s>$497</s></span>
<span class="cm-tax-banner-timer" id="cmBannerCountdown">--d --h --m</span>
<a href="https://stan.store/perolikebro/p/ugc-closer-kit-tax-sale?utm_source=website&utm_medium=tax_banner&utm_campaign=closer_kit&utm_content=tax_banner" class="cm-tax-banner-cta" target="_blank">GET IT →</a>
</div>`;
document.body.insertBefore(banner,document.body.firstChild);

// Banner countdown
var bannerCountdownInterval;
function updateBannerCountdown(){
  var el=document.getElementById('cmBannerCountdown');
  if(!el)return;
  var now=new Date();
  var deadline=new Date(now.getFullYear(),2,31,23,59,59);
  if(now>deadline){
    // Sale has ended — update banner to reflect that
    el.style.display='none';
    var bannerText=document.querySelector('.cm-tax-banner-text');
    if(bannerText)bannerText.innerHTML='TAX SALE HAS ENDED — Join the waitlist for next year';
    var ctaLinks=document.querySelectorAll('.cm-tax-banner-cta');
    ctaLinks.forEach(function(link){link.textContent='JOIN WAITLIST \u2192';});
    if(bannerCountdownInterval)clearInterval(bannerCountdownInterval);
    return;
  }
  var diff=deadline-now;
  var d=Math.floor(diff/(1000*60*60*24));
  var h=Math.floor((diff%(1000*60*60*24))/(1000*60*60));
  var m=Math.floor((diff%(1000*60*60))/(1000*60));
  var s=Math.floor((diff%(1000*60))/1000);
  el.textContent=d+'d '+h+'h '+m+'m '+s+'s';
}
updateBannerCountdown();
bannerCountdownInterval=setInterval(updateBannerCountdown,1000);

// Calculate banner height for offsets
var bannerHeight=40;
function getBannerHeight(){
  var b=document.getElementById('cmTaxBanner');
  return b?b.offsetHeight:40;
}

// Inject CSS
var s=document.createElement('style');
s.textContent=`
.cm-nav{position:fixed;top:40px;left:0;right:0;z-index:1000;background:rgba(10,10,10,0.72);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(34,34,34,0.6);transition:background .3s ease}
.cm-nav-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:56px}
.cm-nav-logo{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:#e8e8e8;text-decoration:none;letter-spacing:-.02em;transition:color .2s;display:flex;align-items:center;gap:10px}
.cm-nav-logo:hover{color:#c8ff00}
.cm-nav-headshot{width:28px;height:28px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(200,255,0,0.4);flex-shrink:0}
.cm-nav-links{display:flex;align-items:center;gap:4px;list-style:none}
.cm-nav-links a{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#999;text-decoration:none;padding:7px 12px;border-radius:8px;transition:color .2s,background .2s;white-space:nowrap}
.cm-nav-links a:hover{color:#e8e8e8;background:rgba(255,255,255,0.04)}
.cm-nav-links a.cm-nav-active{color:#c8ff00}
.cm-nav-cta{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;color:#0a0a0a!important;background:#c8ff00;padding:8px 18px!important;border-radius:8px;text-decoration:none;transition:background .2s,transform .15s;margin-left:6px}
.cm-nav-cta:hover{background:#a8d900!important;color:#0a0a0a!important;transform:translateY(-1px)}
.cm-nav-hamburger{display:none;flex-direction:column;justify-content:center;align-items:center;width:40px;height:40px;background:none;border:none;cursor:pointer;padding:0;gap:6px}
.cm-nav-hamburger span{display:block;width:20px;height:2px;background:#e8e8e8;border-radius:2px;transition:transform .3s,opacity .2s}
.cm-nav-hamburger.cm-active span:nth-child(1){transform:translateY(8px) rotate(45deg)}
.cm-nav-hamburger.cm-active span:nth-child(2){opacity:0}
.cm-nav-hamburger.cm-active span:nth-child(3){transform:translateY(-8px) rotate(-45deg)}
.cm-nav-mobile{display:none;position:fixed;top:96px;left:0;right:0;bottom:0;background:rgba(10,10,10,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:999;overflow-y:auto;transform:translateX(100%);transition:transform .35s cubic-bezier(0.4,0,0.2,1)}
.cm-nav-mobile.cm-active{transform:translateX(0)}
.cm-nav-mobile-inner{padding:24px 24px 48px;display:flex;flex-direction:column;gap:2px}
.cm-nav-mobile-inner a{font-family:'DM Sans',sans-serif;font-size:16px;font-weight:500;color:#999;text-decoration:none;padding:14px 16px;border-radius:10px;transition:color .15s,background .15s;display:block}
.cm-nav-mobile-inner a:hover{color:#e8e8e8;background:rgba(255,255,255,0.04)}
.cm-nav-mobile-inner a.cm-nav-active{color:#c8ff00}
.cm-nav-mobile-cta{margin-top:20px;font-size:16px;font-weight:600;color:#0a0a0a!important;background:#c8ff00!important;text-align:center!important;padding:16px!important;border-radius:10px}
.cm-nav-mobile-cta:hover{background:#a8d900!important;color:#0a0a0a!important}
@media(max-width:768px){.cm-nav-links{display:none}.cm-nav-hamburger{display:flex}.cm-nav-mobile{display:block}}
`;
document.head.appendChild(s);

// Inject HTML
var nav=document.createElement('div');
nav.innerHTML=`
<nav class="cm-nav" id="cmNav">
<div class="cm-nav-inner">
<a href="/" class="cm-nav-logo">closer<em style="color:#c8ff00;font-style:italic">method</em><img src="/assets/elisabeth-headshot.jpg" alt="Elisabeth" class="cm-nav-headshot"></a>
<ul class="cm-nav-links">
<li><a href="/tool1-rate-calculator.html">Rate Calculator</a></li>
<li><a href="https://stan.store/perolikebro/p/ugc-closer-kit-tax-sale?utm_source=website&utm_medium=nav&utm_campaign=closer_kit&utm_content=nav_desktop" class="cm-nav-cta" target="_blank">Close $800+ Deals - $247</a></li>
</ul>
<button class="cm-nav-hamburger" id="cmHamburger" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>
</div>
</nav>
<div class="cm-nav-mobile" id="cmMobileMenu">
<div class="cm-nav-mobile-inner">
<a href="/tool1-rate-calculator.html">Rate Calculator</a>
<a href="https://stan.store/perolikebro/p/ugc-closer-kit-tax-sale?utm_source=website&utm_medium=nav&utm_campaign=closer_kit&utm_content=nav_mobile" class="cm-nav-mobile-cta" target="_blank">Close $800+ Deals - $247</a>
</div>
</div>`;
document.body.insertBefore(nav,document.body.firstChild);

// Add body padding for fixed nav + banner
setTimeout(function(){
  document.body.style.paddingTop=(getBannerHeight()+56)+'px';
},0);

// Event listeners
var hamburger=document.getElementById('cmHamburger');
var mobileMenu=document.getElementById('cmMobileMenu');

hamburger.addEventListener('click',function(){
var isActive=this.classList.toggle('cm-active');
mobileMenu.classList.toggle('cm-active');
this.setAttribute('aria-expanded',isActive);
document.body.style.overflow=isActive?'hidden':'';
});

mobileMenu.querySelectorAll('a').forEach(function(link){
link.addEventListener('click',function(){
hamburger.classList.remove('cm-active');
mobileMenu.classList.remove('cm-active');
hamburger.setAttribute('aria-expanded','false');
document.body.style.overflow='';
});
});

// Highlight current page
var p=window.location.pathname;
document.querySelectorAll('.cm-nav-links a,.cm-nav-mobile-inner a').forEach(function(a){
var h=a.getAttribute('href');
if(h&&(h===p||h===p.replace(/\/$/,'')))a.classList.add('cm-nav-active');
});

// Escape key
document.addEventListener('keydown',function(e){
if(e.key==='Escape'){
if(mobileMenu.classList.contains('cm-active')){
hamburger.classList.remove('cm-active');
mobileMenu.classList.remove('cm-active');
hamburger.setAttribute('aria-expanded','false');
document.body.style.overflow='';
}
}
});

// Recalculate banner height on resize
window.addEventListener('resize',function(){
  var bh=getBannerHeight();
  document.body.style.paddingTop=(bh+56)+'px';
  var navEl=document.getElementById('cmNav');
  if(navEl)navEl.style.top=bh+'px';
  var mob=document.getElementById('cmMobileMenu');
  if(mob)mob.style.top=(bh+56)+'px';
});
})();
