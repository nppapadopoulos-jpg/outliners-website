"""Deterministic source SEO/publication audit, not a Google indexing guarantee."""
from pathlib import Path
from html.parser import HTMLParser
import json,re,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
SITE='https://www.outliners.gr'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.meta={};self.links=[];self.h1=0;self.h2=0;self.title='';self.in_title=False;self.schemas=[];self.schema=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='meta':self.meta[a.get('name') or a.get('property')]=a.get('content')
  if tag=='link':self.links.append(a)
  if tag=='h1':self.h1+=1
  if tag=='h2':self.h2+=1
  if tag=='title':self.in_title=True
  if tag=='script' and a.get('type')=='application/ld+json':self.schema=True
 def handle_endtag(self,tag):
  if tag=='title':self.in_title=False
  if tag=='script':self.schema=False
 def handle_data(self,d):
  if self.in_title:self.title+=d
  if self.schema:self.schemas.append(json.loads(d))
urls=set();titles=set();descs=set()
for p in sorted(ROOT.rglob('*.html')):
 if any(x in p.relative_to(ROOT).parts for x in ['api','docs','node_modules','.git','.preview','.openai']):continue
 rel=p.relative_to(ROOT).as_posix();page=Page();source=p.read_text();
 if re.fullmatch(r'google[a-z0-9]+\.html',rel):
  assert source.strip()=='google-site-verification: '+rel;continue
 page.feed(source)
 if rel=='404.html':assert 'noindex' in page.meta.get('robots','');continue
 url=SITE+'/'+rel.removesuffix('index.html');urls.add(url)
 assert page.title and page.title not in titles,rel+' duplicate title';titles.add(page.title)
 desc=page.meta.get('description');assert desc and desc not in descs,rel+' duplicate description';descs.add(desc)
 assert page.h1==1 and page.h2>=1,rel+' heading hierarchy'
 assert any(x.get('rel')=='canonical' and x.get('href')==url for x in page.links),rel+' canonical'
 alternates={x.get('hreflang'):x.get('href') for x in page.links if x.get('rel')=='alternate'}
 assert set(alternates)=={'en','el','x-default'};assert all(v.startswith(SITE+'/') for v in alternates.values())
 assert page.meta.get('og:url')==url and page.meta.get('og:image','').startswith(SITE+'/')
 assert 'data-cookie-settings' in source and '/assets/js/consent.js' in source
 for schema in page.schemas:assert schema['@type']=='Organization' and schema['legalName']=='OUTLINERS Ε.Ε.' and schema['taxID']=='802260643'
sitemap={n.text for n in ET.parse(ROOT/'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')}
assert sitemap==urls,(sitemap-urls,urls-sitemap)
assert not any('/api/' in u or 'azure' in u for u in sitemap)
assert 'Sitemap: '+SITE+'/sitemap.xml' in (ROOT/'robots.txt').read_text()
for f in ['submit-cv/index.html','el/submit-cv/index.html','request-talent/index.html','el/request-talent/index.html']:assert 'data-preview="true"' in (ROOT/f).read_text()
print('PASS SEO: unique titles/descriptions, canonical/hreflang, sitemap, OG, Organization, cookie settings, closed forms; '+str(len(urls))+' public URLs.')
