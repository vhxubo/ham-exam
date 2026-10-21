#!/usr/bin/env python3
"""build_standalone.py — 生成单文件分享版 dist/ham-exam.html

内联 style.css / app.js / A 类题库（含配图 base64），一个文件发群里即可刷题，
双击本地打开（file://）也能用。只内嵌 A 类；B/C 体积较大不进单文件版。

用法: python3 scripts/build_standalone.py
"""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

def main():
    DIST.mkdir(exist_ok=True)
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    bank = (ROOT / "banks" / "bank-a.js").read_text(encoding="utf-8")

    # 配图内嵌为 data URI
    for ref in set(re.findall(r'"g":"(img/[^"]+)"', bank)):
        data = base64.b64encode((ROOT / "banks" / ref).read_bytes()).decode()
        bank = bank.replace(f'"g":"{ref}"', f'"g":"data:image/jpeg;base64,{data}"')

    html = index.replace(
        '<link rel="stylesheet" href="style.css">',
        f"<style>\n{css}\n</style>")
    html = html.replace(
        '<link rel="manifest" href="manifest.json">', "")
    html = html.replace(
        '<script src="app.js"></script>',
        f"<script>\n{bank}\n</script>\n<script>\n{app}\n</script>")
    # 单文件版不需要 PWA 注册（file:// 下本来就是 no-op，但 https 下会 404 报错）
    html = html.replace('navigator.serviceWorker.register("sw.js").catch(() => {});', "")

    out = DIST / "ham-exam.html"
    out.write_text(html, encoding="utf-8")
    print(f"OK {out} ({out.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    main()
