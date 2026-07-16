#!/usr/bin/env python3
"""
Extract a Readium Web Publication Manifest (RWPM) subset from a zf_info
collection's contents page: an ordered `readingOrder` (the linear page sequence)
plus a heading-grouped `toc`, with a `metadata` block and a `contents` link.
Step 1 of the page-nav project (back / forward / next-chapter / back-to-toc).

Schema is a pragmatic subset of https://readium.org/webpub-manifest/ -- enough
to name fields by an established standard without chasing full conformance
(no @context / media types). Fields: metadata{title,identifier}, links (a
`contents` link to the source index), readingOrder [{href,title}], toc
[{title,children:[{href,title}]}], and a non-standard `coverage` extension.

Each collection is driven by a contents page. Flat collections (zfbook, staging)
have a single index listing their pages in order. Hierarchical ones (monitor,
anatomy) have an index that links per-section sub-indexes; `follow` recurses into
those and inlines their pages. Loose collections (catch, news, ...) have no
ordered index and are reported, not fabricated.

Links are read from <a href> AND <area href> (anatomy uses image maps); order is
document order of the contents page(s).

Usage: build-toc.py [collection ...]   (default: all configured)
Reads src/zf_info/<page>; writes toc/<collection>.json.
"""
import json, os, re, sys, posixpath

ROOT = os.path.join(os.path.dirname(__file__), "..", "src", "zf_info")
OUT  = os.path.join(os.path.dirname(__file__), "..", "src", "zf_info", "toc")

COLLECTIONS = [
    dict(name="zfbook",  label="The Zebrafish Book",           root="zfbook",        seed="zfbook/cont.html",          follow=None),
    dict(name="staging", label="Developmental Staging Series", root="zfbook/stages", seed="zfbook/stages/stages.html", follow=None),
    dict(name="monitor", label="The ZFIN Monitor",             root="monitor",       seed="monitor/mon.html",          follow=r"/cont\.html$"),
    dict(name="anatomy", label="Developmental Anatomy Atlas",  root="anatomy",       seed="anatomy.html",              follow=r"/(24|48|72|120)hrs/(24|48|72|120)hrs\.html$"),
]

TAG = re.compile(r"<h[1-6][^>]*>.*?</h[1-6]>|<a\s[^>]*>.*?</a>|<area\b[^>]*>", re.S | re.I)
HREF = re.compile(r'href="([^"]+)"', re.I)
ALT  = re.compile(r'alt="([^"]*)"', re.I)

def text(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()

def links_in(page_rel):
    """Ordered (resolved_path, label, current_heading) for every link in the page."""
    path = os.path.join(ROOT, page_rel)
    if not os.path.isfile(path):
        return []
    html = open(path, encoding="utf-8", errors="replace").read()
    pagedir = posixpath.dirname(page_rel)
    heading, out = None, []
    for m in TAG.finditer(html):
        tag = m.group(0)
        low = tag[:5].lower()
        if low.startswith("<h") and tag[2] in "123456":
            heading = text(tag)
            continue
        hm = HREF.search(tag)
        if not hm:
            continue                                   # e.g. <a name="...">
        href = hm.group(1)
        if re.match(r"(https?:|mailto:|#|javascript:)", href, re.I):
            continue
        base = href.split("#")[0]
        if not base.endswith(".html"):
            continue
        if low.startswith("<area"):
            am = ALT.search(tag); label = text(am.group(1)) if am else ""
        else:
            label = text(tag)
        out.append((posixpath.normpath(posixpath.join(pagedir, base)), label, heading))
    return out

def build(coll):
    root, seed, follow = coll["root"], coll["seed"], coll.get("follow")
    follow_re = re.compile(follow) if follow else None
    spine, visited = [], set()

    def in_coll(p): return p == root or p.startswith(root + "/")

    def walk(page_rel, section, depth):
        for resolved, label, heading in links_in(page_rel):
            if not in_coll(resolved) or resolved in visited:
                continue
            sect = section or heading
            if follow_re and follow_re.search("/" + resolved) and depth < 3:
                visited.add(resolved)
                walk(resolved, label or sect, depth + 1)
            else:
                visited.add(resolved)
                spine.append({"href": "/zf_info/" + resolved, "title": label, "section": sect})

    walk(seed, None, 0)

    toc = []
    for p in spine:
        if not toc or toc[-1]["title"] != p["section"]:
            toc.append({"title": p["section"], "children": []})
        toc[-1]["children"].append({"href": p["href"], "title": p["title"]})

    reading_order = [{"href": p["href"], "title": p["title"]} for p in spine]

    total = len({os.path.relpath(os.path.join(dp, f), ROOT).replace(os.sep, "/")
                 for dp, _, fs in os.walk(os.path.join(ROOT, root)) for f in fs if f.endswith(".html")})
    return {
        "metadata": {"title": coll["label"], "identifier": coll["name"]},
        "links": [{"rel": "contents", "href": "/zf_info/" + seed}],
        "readingOrder": reading_order,
        "toc": toc,
        "coverage": {"readingOrderPages": len(reading_order), "collectionHtmlPages": total},
    }

names = sys.argv[1:] or [c["name"] for c in COLLECTIONS]
for coll in COLLECTIONS:
    if coll["name"] not in names:
        continue
    doc = build(coll)
    json.dump(doc, open(os.path.join(OUT, coll["name"] + ".json"), "w"), indent=2)
    c = doc["coverage"]
    print(f"{coll['name']:9} readingOrder={c['readingOrderPages']:3}  collection_pages={c['collectionHtmlPages']:3}  toc_groups={len(doc['toc'])}")
