#!/usr/bin/env python3
"""
Pobiera ostatnie posty ze strony Meble Grosman na Facebooku (Graph API)
i zapisuje je jako statyczne pliki dla strony:

    data/facebook.json   lista postów (tekst, data, link, zdjęcia)
    img/fb/*.webp        zdjęcia z postów, zmniejszone i skompresowane

Uruchamiane przez GitHub Action (.github/workflows/facebook.yml).
Token strony leży w sekretach repozytorium i nigdy nie trafia do przeglądarki.

Zmienne środowiskowe:
    FB_PAGE_TOKEN     (wymagany) token dostępu strony, bez daty wygaśnięcia
    FB_APP_SECRET     (opcjonalny) sekret aplikacji, jeśli włączone jest "Require App Secret"
    FB_GRAPH_VERSION  (opcjonalny) wersja Graph API, domyślnie v26.0
"""

from __future__ import annotations

import hashlib
import hmac
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "facebook.json"
IMG_DIR = ROOT / "img" / "fb"
IMG_PREFIX = "img/fb/"

GRAPH = "https://graph.facebook.com/" + os.environ.get("FB_GRAPH_VERSION", "v26.0")
PAGE_URL = "https://www.facebook.com/meblegrosman"

MAX_POSTS = 9          # tyle postów pokazuje strona
MAX_IMAGES = 8         # maks. zdjęć z jednego posta (album)
MAX_SIDE = 1280        # najdłuższy bok zdjęcia w px
WEBP_QUALITY = 80
MAX_PAGES = 4          # ile stron wyników API przejrzeć w poszukiwaniu postów ze zdjęciami
REFRESH_DAYS = 25      # nawet bez nowych postów odśwież znacznik co tyle dni,
                       # żeby GitHub nie wyłączył harmonogramu po 60 dniach ciszy

FIELDS = (
    "id,message,created_time,permalink_url,full_picture,status_type,"
    "attachments{media_type,type,media,url,"
    "subattachments.limit(20){media,media_type,type,url}}"
)


def fail(msg: str) -> None:
    print(f"BŁĄD: {msg}", file=sys.stderr)
    sys.exit(1)


def token() -> str:
    tok = os.environ.get("FB_PAGE_TOKEN", "").strip()
    if not tok:
        fail("Brak sekretu FB_PAGE_TOKEN. Dodaj go w Settings > Secrets and variables > Actions.")
    return tok


def auth_params() -> dict:
    tok = token()
    params = {"access_token": tok}
    secret = os.environ.get("FB_APP_SECRET", "").strip()
    if secret:
        params["appsecret_proof"] = hmac.new(secret.encode(), tok.encode(), hashlib.sha256).hexdigest()
    return params


def http_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "meble-grosman-site/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as err:
        # Komunikat Graph API (bez adresu, bo adres zawiera token)
        try:
            detail = json.loads(err.read().decode("utf-8", "replace")).get("error", {})
            msg = f"{detail.get('type', '')} {detail.get('code', '')}: {detail.get('message', '')}"
        except Exception:
            msg = str(err.code)
        fail(f"Graph API odpowiedziało błędem {msg}")
    except urllib.error.URLError as err:
        fail(f"Brak połączenia z Graph API: {err.reason}")
    return {}


def graph(path: str, **params) -> dict:
    query = urllib.parse.urlencode({**params, **auth_params()})
    return http_json(f"{GRAPH}/{path}?{query}")


def clean_text(text: str | None) -> str:
    text = (text or "").replace("\r\n", "\n").strip()
    # hashtagi doklejone na końcu wpisu nic nie wnoszą na stronie
    text = re.sub(r"(?:\s*#\w+)+\s*$", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    if len(text) > 700:
        text = text[:700].rsplit(" ", 1)[0] + "…"
    return text


def image_urls(post: dict) -> tuple[list[str], bool]:
    """Zwraca (adresy zdjęć, czy_to_film). Pomija posty bez zdjęć, np. udostępnione linki."""
    urls: list[str] = []
    is_video = False
    usable = False

    for att in (post.get("attachments") or {}).get("data", []):
        media_type = (att.get("media_type") or "").lower()
        if media_type in ("photo", "album"):
            usable = True
        elif media_type == "video":
            usable = True
            is_video = True
        else:
            continue

        subs = (att.get("subattachments") or {}).get("data") or [att]
        for sub in subs:
            if (sub.get("media_type") or sub.get("type") or "").lower().startswith("video"):
                continue
            src = ((sub.get("media") or {}).get("image") or {}).get("src")
            if src and src not in urls:
                urls.append(src)

    if not usable:
        return [], False

    # full_picture ma zwykle wyższą rozdzielczość niż miniatura pierwszego zdjęcia
    full = post.get("full_picture")
    if full:
        if urls:
            urls[0] = full
        else:
            urls = [full]

    if is_video:
        urls = urls[:1]  # przy filmie wystarczy kadr podglądu
    return urls[:MAX_IMAGES], is_video


def safe_id(post_id: str) -> str:
    return re.sub(r"[^\w-]", "_", post_id)


def save_image(url: str, dest: Path) -> tuple[int, int]:
    """Pobiera zdjęcie, obraca wg EXIF, zmniejsza i zapisuje jako WebP. Istniejących nie pobiera drugi raz."""
    if dest.exists():
        with Image.open(dest) as im:
            return im.size
    req = urllib.request.Request(url, headers={"User-Agent": "meble-grosman-site/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
    with Image.open(io.BytesIO(raw)) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "WEBP", quality=WEBP_QUALITY, method=6)
        return im.size


def iso_date(fb_time: str) -> str:
    # Graph API zwraca np. 2026-09-30T12:04:11+0000
    try:
        return datetime.strptime(fb_time, "%Y-%m-%dT%H:%M:%S%z").astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError):
        return fb_time or ""


def safe_permalink(url: str | None) -> str:
    if isinstance(url, str) and re.match(r"^https://(www\.|m\.|web\.)?facebook\.com/", url):
        return url
    return PAGE_URL


def collect_posts() -> list[dict]:
    page = graph("me", fields="id,name")
    print(f"Strona: {page.get('name')} ({page.get('id')})")

    result = graph("me/posts", fields=FIELDS, limit=25)
    raw_posts: list[dict] = []
    for _ in range(MAX_PAGES):
        raw_posts.extend(result.get("data", []))
        selected = [p for p in raw_posts if image_urls(p)[0]]
        nxt = (result.get("paging") or {}).get("next")
        if len(selected) >= MAX_POSTS or not nxt:
            break
        result = http_json(nxt)  # adres "next" zawiera już token

    posts: list[dict] = []
    for post in raw_posts:
        urls, is_video = image_urls(post)
        if not urls:
            continue
        pid = safe_id(post["id"])
        images = []
        for i, url in enumerate(urls, start=1):
            name = f"{pid}-{i}.webp"
            try:
                w, h = save_image(url, IMG_DIR / name)
            except Exception as exc:  # pojedyncze zdjęcie nie może zatrzymać całości
                print(f"  pominięto zdjęcie {name}: {exc}")
                continue
            images.append({"src": IMG_PREFIX + name, "w": w, "h": h})
        if not images:
            continue
        posts.append({
            "id": post["id"],
            "date": iso_date(post.get("created_time")),
            "text": clean_text(post.get("message")),
            "link": safe_permalink(post.get("permalink_url")),
            "video": is_video,
            "images": images,
        })
        if len(posts) >= MAX_POSTS:
            break
    return posts


def main() -> None:
    posts = collect_posts()
    print(f"Postów ze zdjęciami: {len(posts)}")

    old = {}
    if DATA_FILE.exists():
        try:
            old = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            old = {}

    if not posts:
        # nie kasujemy ostatnich dobrych danych z powodu chwilowego problemu
        print("API nie zwróciło postów ze zdjęciami, zostawiam poprzednie dane.")
        return

    today = date.today()
    last = old.get("updated")
    stale = True
    if last:
        try:
            stale = (today - date.fromisoformat(last)).days >= REFRESH_DAYS
        except ValueError:
            stale = True

    if old.get("posts") != posts or stale:
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        DATA_FILE.write_text(
            json.dumps({"updated": today.isoformat(), "page": PAGE_URL, "posts": posts},
                       ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print("Zapisano data/facebook.json")
    else:
        print("Bez zmian w postach.")

    # usuń zdjęcia postów, które wypadły z listy
    keep = {Path(im["src"]).name for p in posts for im in p["images"]}
    if IMG_DIR.exists():
        for f in IMG_DIR.glob("*.webp"):
            if f.name not in keep:
                f.unlink()
                print(f"  usunięto {f.name}")


if __name__ == "__main__":
    main()
