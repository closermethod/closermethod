// Global Navigation - closermethod
// Add <script src="/global-nav.js" defer></script> to any page
(function(){
// Skip if nav already exists or if page opts out
if(document.getElementById('cmNav'))return;
if(document.body.getAttribute('data-no-nav')==='true')return;

// Inject CSS
var s=document.createElement('style');
s.textContent=`
.cm-nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(10,10,10,0.72);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(34,34,34,0.6);transition:background .3s ease}
.cm-nav-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:56px}
.cm-nav-logo{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:#e8e8e8;text-decoration:none;letter-spacing:-.02em;transition:color .2s;display:flex;align-items:center;gap:10px}
.cm-nav-logo:hover{color:#c8ff00}
.cm-nav-headshot{width:28px;height:28px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(200,255,0,0.4);flex-shrink:0}
.cm-nav-links{display:flex;align-items:center;gap:4px;list-style:none}
.cm-nav-links a{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#999;text-decoration:none;padding:7px 12px;border-radius:8px;transition:color .2s,background .2s;white-space:nowrap}
.cm-nav-links a:hover{color:#e8e8e8;background:rgba(255,255,255,0.04)}
.cm-nav-links a.cm-nav-active{color:#c8ff00}
.cm-nav-dropdown{position:relative}
.cm-nav-dropdown-trigger{display:flex;align-items:center;gap:4px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#999;padding:7px 12px;border-radius:8px;border:none;background:none;transition:color .2s,background .2s}
.cm-nav-dropdown-trigger:hover{color:#e8e8e8;background:rgba(255,255,255,0.04)}
.cm-nav-dropdown-arrow{width:10px;height:10px;transition:transform .25s}
.cm-nav-dropdown:hover .cm-nav-dropdown-arrow,.cm-nav-dropdown.cm-open .cm-nav-dropdown-arrow{transform:rotate(180deg)}
.cm-nav-dropdown-menu{position:absolute;top:calc(100% + 8px);left:0;min-width:200px;background:#141414;border:1px solid #222;border-radius:12px;padding:6px;opacity:0;visibility:hidden;transform:translateY(-8px);transition:opacity .2s,transform .2s,visibility .2s;box-shadow:0 16px 48px rgba(0,0,0,0.4)}
.cm-nav-dropdown:hover .cm-nav-dropdown-menu,.cm-nav-dropdown.cm-open .cm-nav-dropdown-menu{opacity:1;visibility:visible;transform:translateY(0)}
.cm-nav-dropdown-menu a{display:block;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#999;text-decoration:none;padding:9px 12px;border-radius:8px;transition:color .15s,background .15s}
.cm-nav-dropdown-menu a:hover{color:#e8e8e8;background:rgba(255,255,255,0.04)}
.cm-nav-cta{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;color:#0a0a0a!important;background:#c8ff00;padding:8px 18px!important;border-radius:8px;text-decoration:none;transition:background .2s,transform .15s;margin-left:6px}
.cm-nav-cta:hover{background:#a8d900!important;color:#0a0a0a!important;transform:translateY(-1px)}
.cm-nav-hamburger{display:none;flex-direction:column;justify-content:center;align-items:center;width:40px;height:40px;background:none;border:none;cursor:pointer;padding:0;gap:6px}
.cm-nav-hamburger span{display:block;width:20px;height:2px;background:#e8e8e8;border-radius:2px;transition:transform .3s,opacity .2s}
.cm-nav-hamburger.cm-active span:nth-child(1){transform:translateY(8px) rotate(45deg)}
.cm-nav-hamburger.cm-active span:nth-child(2){opacity:0}
.cm-nav-hamburger.cm-active span:nth-child(3){transform:translateY(-8px) rotate(-45deg)}
.cm-nav-mobile{display:none;position:fixed;top:56px;left:0;right:0;bottom:0;background:rgba(10,10,10,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:999;overflow-y:auto;transform:translateX(100%);transition:transform .35s cubic-bezier(0.4,0,0.2,1)}
.cm-nav-mobile.cm-active{transform:translateX(0)}
.cm-nav-mobile-inner{padding:24px 24px 48px;display:flex;flex-direction:column;gap:2px}
.cm-nav-mobile-inner a{font-family:'DM Sans',sans-serif;font-size:16px;font-weight:500;color:#999;text-decoration:none;padding:14px 16px;border-radius:10px;transition:color .15s,background .15s;display:block}
.cm-nav-mobile-inner a:hover{color:#e8e8e8;background:rgba(255,255,255,0.04)}
.cm-nav-mobile-inner a.cm-nav-active{color:#c8ff00}
.cm-nav-mobile-label{font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#666;padding:20px 16px 6px}
.cm-nav-mobile-sub a{padding-left:28px!important;font-size:15px!important}
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
<li class="cm-nav-dropdown" id="cmDropdown">
<button class="cm-nav-dropdown-trigger" aria-expanded="false" aria-haspopup="true">Free Tools <svg class="cm-nav-dropdown-arrow" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<div class="cm-nav-dropdown-menu">
<a href="/tool1-rate-calculator.html">Rate Calculator</a>
<a href="/tool2-brand-qualifier.html">Brand Qualifier</a>
<a href="/tool3-closer-coach.html">Closer Coach</a>
<a href="/tool5-negotiation-sim.html">Negotiation Sim</a>
<a href="/tool6-pitch-review.html">Pitch Review</a>
<a href="/tool10-income-calculator.html">Income Calculator</a>
</div>
</li>
<li><a href="/brand-database.html">Brands</a></li>
<li><a href="/closer-score-quiz.html">Quiz</a></li>
<li><a href="/pitch-vault.html">Pitch Vault</a></li>
<li><a href="/#results">Results</a></li>
<li><a href="https://stan.store/perolikebro/p/ugc-closer-kit-tax-sale?utm_source=website&utm_medium=nav&utm_campaign=closer-kit" class="cm-nav-cta" target="_blank">Close $800+ Deals - $197</a></li>
</ul>
<button class="cm-nav-hamburger" id="cmHamburger" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>
</div>
</nav>
<div class="cm-nav-mobile" id="cmMobileMenu">
<div class="cm-nav-mobile-inner">
<div class="cm-nav-mobile-label">Free Tools</div>
<div class="cm-nav-mobile-sub">
<a href="/tool1-rate-calculator.html">Rate Calculator</a>
<a href="/tool2-brand-qualifier.html">Brand Qualifier</a>
<a href="/tool3-closer-coach.html">Closer Coach</a>
<a href="/tool5-negotiation-sim.html">Negotiation Sim</a>
<a href="/tool6-pitch-review.html">Pitch Review</a>
<a href="/tool10-income-calculator.html">Income Calculator</a>
</div>
<div class="cm-nav-mobile-label">Pages</div>
<a href="/brand-database.html">Brand Database</a>
<a href="/closer-score-quiz.html">Closer Score Quiz</a>
<a href="/pitch-vault.html">Pitch Vault - $27</a>
<a href="/#results">Real Results</a>
<a href="https://stan.store/perolikebro/p/ugc-closer-kit-tax-sale?utm_source=website&utm_medium=nav&utm_campaign=closer-kit" class="cm-nav-mobile-cta" target="_blank">Close $800+ Deals - $197</a>
</div>
</div>`;
document.body.insertBefore(nav,document.body.firstChild);

// Add body padding for fixed nav
document.body.style.paddingTop='56px';

// Event listeners
var hamburger=document.getElementById('cmHamburger');
var mobileMenu=document.getElementById('cmMobileMenu');
var dropdown=document.getElementById('cmDropdown');
var trigger=dropdown.querySelector('.cm-nav-dropdown-trigger');

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

trigger.addEventListener('click',function(e){
e.stopPropagation();
var isOpen=dropdown.classList.toggle('cm-open');
this.setAttribute('aria-expanded',isOpen);
});

document.addEventListener('click',function(e){
if(!dropdown.contains(e.target)){
dropdown.classList.remove('cm-open');
trigger.setAttribute('aria-expanded','false');
}
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
dropdown.classList.remove('cm-open');
trigger.setAttribute('aria-expanded','false');
if(mobileMenu.classList.contains('cm-active')){
hamburger.classList.remove('cm-active');
mobileMenu.classList.remove('cm-active');
hamburger.setAttribute('aria-expanded','false');
document.body.style.overflow='';
}
}
});
})();
