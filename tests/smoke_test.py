#!/usr/bin/env python3
"""Smoke tests for the OutLiners static site.

Stdlib only. Run from the repository root:  python3 tests/smoke_test.py
Checks every HTML page for: resolvable internal links and asset references,
exactly one <h1>, a <title> and meta description, correct lang attributes on
the /el/ tree, hreflang alternates on indexable pages, and alt text on images.
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://outliners.gr"
errors = []


def err(msg):
    errors.append(msg)


def resolve(href):
    """Map a root-relative href/src to a repository file path."""
    path = href.split("#")[0].split("?")[0]
    if not path.startswith("/"):
        return None  # external / mailto / tel / relative-anchor: not checked
    target = path.lstrip("/")
    if target == "" or target.endswith("/"):
        target += "index.html"
    return os.path.join(ROOT, target)


def main():
    pages = sorted(p for p in glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True)
                   if "node_modules" not in os.path.relpath(p, ROOT).split(os.sep)
                   and os.path.relpath(p, ROOT).split(os.sep)[0] != "api")
    if len(pages) < 10:
        err(f"expected at least 10 pages, found {len(pages)}")

    for page in pages:
        rel = os.path.relpath(page, ROOT)
        html = open(page, encoding="utf-8").read()
        if re.fullmatch(r'google[a-z0-9]+\.html', rel):
            if open(page, encoding='utf-8').read().strip() != 'google-site-verification: '+rel:
                err(f'{rel}: invalid Google verification file')
            continue
        is_greek = rel.startswith("el/") or rel.startswith("el" + os.sep)
        is_404 = rel == "404.html"

        # Internal links and assets resolve
        for attr, value in re.findall(r'(href|src)="([^"]+)"', html):
            if value.startswith(SITE):
                value = value[len(SITE):] or "/"
            target = resolve(value)
            if target and not os.path.exists(target):
                err(f"{rel}: broken {attr} -> {value}")

        # Exactly one h1
        h1s = re.findall(r"<h1[\s>]", html)
        if len(h1s) != 1:
            err(f"{rel}: expected 1 <h1>, found {len(h1s)}")

        # Title and description
        if not re.search(r"<title>[^<]+</title>", html):
            err(f"{rel}: missing <title>")
        if not is_404 and 'name="description"' not in html:
            err(f"{rel}: missing meta description")

        # Language attribute per tree
        want_lang = "el" if is_greek else "en"
        if not is_404 and f'<html lang="{want_lang}">' not in html:
            err(f"{rel}: expected <html lang=\"{want_lang}\">")

        # Greek pages must link internally within /el/
        if is_greek:
            for href in re.findall(r'href="(/[^"]*)"', html):
                if href.startswith(("/assets/", "/favicon", "/el/")):
                    continue
                if href == "/" or not href.startswith("/el"):
                    # The language switch link to the EN variant is allowed
                    # (it carries hreflang="en").
                    pattern = re.escape(href)
                    if not re.search(rf'href="{pattern}"[^>]*hreflang="en"', html):
                        err(f"{rel}: EN-tree link without hreflang=\"en\": {href}")

        # Indexable pages carry hreflang alternates
        if not is_404 and 'name="robots" content="noindex"' not in html:
            for code in ("en", "el", "x-default"):
                if f'hreflang="{code}"' not in html:
                    err(f"{rel}: missing hreflang alternate '{code}'")

        # Images have alt text
        for img in re.findall(r"<img[^>]*>", html):
            if "alt=" not in img:
                err(f"{rel}: <img> without alt")

        # Authentic logo in header on every page
        if '<a class="brand"' in html and "assets/img/logo-white.png" not in html:
            err(f"{rel}: header brand is not the authentic logo asset")

        # Language switch: each page links to its exact counterpart
        if not is_404:
            page_url = "/" + rel.replace(os.sep, "/")
            page_url = re.sub(r"index\.html$", "", page_url)
            if is_greek:
                counterpart = page_url[len("/el"):] or "/"
                want = f'class="lang-toggle" href="{counterpart}" hreflang="en"'
            else:
                counterpart = "/el" + page_url
                want = f'class="lang-toggle" href="{counterpart}" hreflang="el"'
            if want not in html:
                err(f"{rel}: language switch does not link to {counterpart}")
            # hreflang alternates must name this page and its counterpart
            en_url = counterpart if is_greek else page_url
            el_url = page_url if is_greek else counterpart
            for code, u in (("en", en_url), ("el", el_url)):
                if f'hreflang="{code}" href="{SITE}{u}"' not in html:
                    err(f"{rel}: hreflang '{code}' does not point to {u}")
            # canonical must be this page's own URL
            if f'rel="canonical" href="{SITE}{page_url}"' not in html:
                err(f"{rel}: canonical is not {page_url}")

        # Main navigation present and complete
        if not is_404:
            prefix = "/el" if is_greek else ""
            for target in ("/services/", "/industries/", "/about/", "/contact/"):
                if f'href="{prefix}{target}"' not in html:
                    err(f"{rel}: navigation is missing link to {prefix}{target}")

    # Sitemap entries resolve and cover both languages
    sitemap = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
    locs = re.findall(r"<loc>([^<]+)</loc>", sitemap)
    if not any("/el/" in u for u in locs):
        err("sitemap.xml: no Greek URLs")
    for u in locs:
        target = resolve(u[len(SITE):] or "/")
        if target and not os.path.exists(target):
            err(f"sitemap.xml: entry has no file -> {u}")

    if errors:
        print(f"FAIL — {len(errors)} problem(s):")
        for e in errors:
            print("  -", e)
        return 1
    print(f"OK — {len(pages)} pages checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
