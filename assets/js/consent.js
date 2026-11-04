/* First-party consent UI; Basic Consent Mode. No Google request before opt-in.
 * No form values, candidate IDs, arbitrary query strings or hash are measured. */
(function () {
  'use strict';
  var KEY='outliners-consent-v1', VERSION=1, DAYS=180, MAX_AGE=DAYS*86400000;
  var el=document.documentElement.lang==='el', current=null, loaded=false, configured=false, pageSent=false, previousFocus=null;
  var config=window.OUTLINERS_SITE_CONFIG || {}, id=config.ga4MeasurementId || '';
  var production=location.protocol==='https:' && ['outliners.gr','www.outliners.gr'].includes(location.hostname);
  var allowedPaths=['/','/about/','/contact/','/cookies/','/privacy-policy/','/services/','/industries/','/submit-cv/','/request-talent/','/services/recruitment-executive-search/','/services/embedded-talent-partner/','/services/talent-advisory/'];
  var publicPath=location.pathname.replace(/^\/el(?=\/)/,'/') .replace(/^\/\//,'/');
  var eligible=production && allowedPaths.includes(publicPath) && /^G-[A-Z0-9]{6,15}$/.test(id);
  var seen=new Set(), expiryTimer=null;
  function read(){try{var v=JSON.parse(localStorage.getItem(KEY));if(v&&v.version===VERSION&&typeof v.analytics==='boolean'&&Number.isFinite(v.at)&&v.at<=Date.now()&&Date.now()-v.at<MAX_AGE)return v;}catch{}try{localStorage.removeItem(KEY);}catch{}return null;}
  function remember(value){current={version:VERSION,analytics:value,at:Date.now()};try{localStorage.setItem(KEY,JSON.stringify(current));}catch{}scheduleExpiry();}
  function canMeasure(){return eligible&&current?.analytics===true&&Date.now()-current.at<MAX_AGE;}
  function safePage(){return 'https://www.outliners.gr'+location.pathname;}
  function referrer(){try{var u=new URL(document.referrer);return ['outliners.gr','www.outliners.gr','www.google.com','www.google.gr','google.com','www.bing.com','bing.com','www.linkedin.com','linkedin.com'].includes(u.hostname)?u.origin+'/':'';}catch{return '';}}
  function attribution(){
    var params=new URLSearchParams(location.search), source=params.get('utm_source'),medium=params.get('utm_medium'), result={campaign_id:'not-set',campaign_name:'not-set',campaign_term:'not-set',campaign_content:'not-set',campaign_source:'(direct)',campaign_medium:'(none)'};
    try { var ref=new URL(document.referrer);if(!['outliners.gr','www.outliners.gr'].includes(ref.hostname)){result.campaign_source='other-referral';result.campaign_medium='referral';if(['www.google.com','www.google.gr','google.com'].includes(ref.hostname)){result.campaign_source='google';result.campaign_medium='organic';}if(['www.bing.com','bing.com'].includes(ref.hostname)){result.campaign_source='bing';result.campaign_medium='organic';}if(['www.linkedin.com','linkedin.com'].includes(ref.hostname)){result.campaign_source='linkedin';result.campaign_medium='social';}} } catch {}
    if(['google','bing','linkedin','newsletter','outliners'].includes(source))result.campaign_source=source;
    if(['organic','social','email','referral','cpc'].includes(medium))result.campaign_medium=medium;
    // All other free-text campaign fields, IDs and query strings are discarded.
    return result;
  }
  function gtag(){window.dataLayer.push(arguments);}
  function start(){
    if(!canMeasure())return;
    window['ga-disable-'+id]=false;
    if(!loaded){
      // Prevent the provider's automatic UTM/click-ID fallback from reading arbitrary
      // public URL text. Capture only our allowlisted attribution, then clear query/hash.
      var campaign=attribution();
      if(location.search||location.hash){try{history.replaceState(history.state,'',location.pathname);}catch{return;}}
      loaded=true;window.dataLayer=[];
      gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      gtag('js',new Date());
      gtag('config',id,Object.assign({send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:safePage(),page_referrer:referrer(),page_title:document.title,cookie_domain:'outliners.gr',cookie_expires:DAYS*86400,cookie_update:false,cookie_flags:'SameSite=Lax;Secure'},campaign));
      configured=true;
      var script=document.createElement('script');script.async=true;script.id='outliners-ga4';script.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(script);
    }
    if(!pageSent){pageSent=true;gtag('event','page_view',{send_to:id,page_location:safePage(),page_referrer:referrer(),page_title:document.title});}
  }
  function clearCookies(){
    document.cookie.split(';').forEach(function(part){var name=part.split('=')[0].trim();if(!/^_ga(?:_|$)/.test(name))return;
      ['',location.hostname,'.'+location.hostname,'outliners.gr','.outliners.gr'].forEach(function(domain){document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');});
    });
  }
  function stop(){window['ga-disable-'+id]=true;clearCookies();if(loaded){window.dataLayer=[];location.reload();}}
  function scheduleExpiry(){clearTimeout(expiryTimer);if(!current)return;var remaining=MAX_AGE-(Date.now()-current.at);if(remaining<=0){current=null;try{localStorage.removeItem(KEY);}catch{}banner.hidden=false;stop();return;}expiryTimer=setTimeout(scheduleExpiry,Math.min(remaining,2147483647));}
  function decide(value){remember(value);banner.hidden=true;close();if(value)start();else stop();}
  window.OutlinersAnalytics=Object.freeze({
    // Call only from the committed-success branch; never queue conversions for later consent.
    submissionSuccess:function(form,submissionId,duplicate){
      if(!canMeasure()||!configured||duplicate===true||!['submit-cv','request-talent'].includes(form)||typeof submissionId!=='string'||!/^[0-9a-f-]{36}$/i.test(submissionId)||seen.has(submissionId))return;
      seen.add(submissionId);gtag('event',form==='submit-cv'?'submit_cv_success':'request_talent_success',{send_to:id,page_location:safePage(),page_referrer:referrer(),language:el?'el':'en'});
    }
  });
  var content=el?{
    title:'Η ιδιωτικότητά σου, η επιλογή σου.',text:'Χρησιμοποιούμε απαραίτητες τεχνολογίες για τη λειτουργία του site. Με την επιλογή σου, το Google Analytics μάς βοηθά να κατανοούμε την επισκεψιμότητα και τις επιτυχημένες υποβολές. Δεν μετράμε στοιχεία ή περιεχόμενο βιογραφικών.',accept:'Αποδοχή όλων',reject:'Απόρριψη μη απαραίτητων',settings:'Ρυθμίσεις cookies',policy:'Πολιτική cookies',essential:'Απαραίτητα — πάντα ενεργά',analytics:'Στατιστικά Google Analytics',save:'Αποθήκευση επιλογών',close:'Κλείσιμο ρυθμίσεων',detail:'Τα στατιστικά είναι προαιρετικά. Η απόρριψη δεν επηρεάζει τις φόρμες ή την πρόσβαση Owner.'
  }:{title:'Your privacy. Your choice.',text:'We use essential technologies to run this site. With your permission, Google Analytics helps us understand visits and successful submissions. We never measure CV details or contents.',accept:'Accept all',reject:'Reject non-essential',settings:'Cookie settings',policy:'Cookie Policy',essential:'Essential — always on',analytics:'Google Analytics statistics',save:'Save choices',close:'Close settings',detail:'Statistics are optional. Rejecting them does not affect forms or Owner access.'};
  function node(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;}
  function button(text,fn){var b=node('button','consent-button',text);b.type='button';b.addEventListener('click',fn);return b;}
  var banner=node('section','consent-banner');banner.setAttribute('aria-labelledby','consent-title');banner.id='cookie-consent';banner.hidden=true;
  var copy=node('div','consent-copy'),title=node('h2','',content.title);title.id='consent-title';copy.append(title,node('p','',content.text));
  var policy=node('a','',content.policy);policy.href=el?'/el/cookies/':'/cookies/';copy.append(policy);
  var actions=node('div','consent-actions');actions.append(button(content.accept,()=>decide(true)),button(content.reject,()=>decide(false)),button(content.settings,open));banner.append(copy,actions);document.body.append(banner);
  var dialog=node('dialog','consent-dialog');dialog.setAttribute('aria-labelledby','consent-settings-title');
  var heading=node('h2','',content.settings);heading.id='consent-settings-title';var check=node('input');check.type='checkbox';check.id='consent-analytics';
  var label=node('label','consent-option');label.append(check,document.createTextNode(content.analytics));
  var dialogActions=node('div','consent-actions');dialogActions.append(button(content.save,()=>decide(check.checked)),button(content.reject,()=>decide(false)),button(content.accept,()=>decide(true)),button(content.close,close));
  dialog.append(heading,node('p','',content.detail),node('p','consent-essential',content.essential),label,dialogActions);document.body.append(dialog);
  function open(){previousFocus=document.activeElement;check.checked=current?.analytics===true;dialog.showModal();}
  function close(){if(dialog.open)dialog.close();}
  dialog.addEventListener('close',function(){if(previousFocus?.isConnected)previousFocus.focus();});
  document.querySelectorAll('[data-cookie-settings]').forEach(function(b){b.addEventListener('click',open);});
  window.addEventListener('storage',function(event){if(event.key!==KEY)return;current=read();if(!current?.analytics)stop();else start();banner.hidden=!!current;});
  current=read();scheduleExpiry();banner.hidden=!!current;if(current?.analytics)start();else {window['ga-disable-'+id]=true;clearCookies();}
  // Expired consent cannot silently keep measuring in a long-open tab.
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&current&&Date.now()-current.at>=MAX_AGE){current=null;banner.hidden=false;stop();}});
})();
