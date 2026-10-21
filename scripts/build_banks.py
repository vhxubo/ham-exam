#!/usr/bin/env python3
"""build_banks.py — 把 data/raw/{A,B,C}.json 构建成 banks/bank-*.js

字段压缩：i=唯一id j=官方题号(LY0001/LX等) p=分类(1.1.1) q=题干
o=选项文本数组(原始顺序) a=正确答案下标数组 e=解析 m=助记 g=配图路径
单选题源数据答案恒为 A，展示时由前端打乱选项顺序。

用法: python3 scripts/build_banks.py
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
BANKS = ROOT / "banks"

# 2025-10 版考核规格（来源：CRAC 考核标准 / ham-exam-web src/lib/exam-rules.ts）
RULES = {
    "A": {"total": 40, "singles": 32, "multiples": 8, "minutes": 40, "pass": 30},
    "B": {"total": 60, "singles": 45, "multiples": 15, "minutes": 60, "pass": 45},
    "C": {"total": 90, "singles": 70, "multiples": 20, "minutes": 90, "pass": 70},
}

CHAPTERS = {
    "A": {
        "1": "法律法规与频率管理",
        "2": "操作技术与通联规范",
        "3": "收发信机、天线与馈线",
        "4": "电工电子技术基础",
        "5": "安全防护与电磁环境",
    },
    "B": {
        "1": "法律法规与频率管理",
        "2": "操作技术与通联规范",
        "3": "收发信机、天线与馈线",
        "4": "电工电子技术",
        "5": "安全防护与电磁环境",
    },
}

SECTIONS = {
    "A": {
        "1.1": "无线电管理法规体系与频率划分概念",
        "1.2": "业余无线电台的设置许可与执照",
        "1.3": "操作技术能力验证与 A/B/C 分类",
        "1.4": "业余无线电台呼号",
        "1.5": "业余电台的合法使用与操作规范",
        "1.6": "监督检查与法律责任",
        "1.7": "业余频率的使用规则",
        "2.1": "ITU 分区与字母解释法",
        "2.2": "通联程序与通信日志",
        "2.3": "频率的守听与礼让",
        "2.4": "Q 简语与通信缩语",
        "2.5": "发射类别（emission designator）",
        "2.6": "数字通信模式",
        "3.1": "收发信机及周边设备",
        "3.3": "天线、馈线与电波传播",
        "3.6": "发射调测与收发信机指标",
        "3.8": "卫星通信",
        "4.1": "电工电子基础",
        "4.6": "测量仪表",
        "5.1": "安全防护与电磁环境",
    },
    "B": {
        "1.1": "无线电管理法规体系与频率划分概念",
        "1.2": "业余无线电台的设置许可与执照",
        "1.3": "操作技术能力验证与 A/B/C 分类",
        "1.4": "业余无线电台呼号",
        "1.5": "业余电台的合法使用与操作规范",
        "1.6": "监督检查与法律责任",
        "1.7": "业余频率的使用规则",
        "2.1": "ITU/CQ 分区与字母解释法",
        "2.2": "通联程序、日志与深空通信",
        "2.3": "守听、礼让与 CW 发送速度",
        "2.4": "Q 简语与通信缩语",
        "2.5": "发射类别与调幅（AM）特性",
        "2.6": "发射类别、频移电报与数字模式",
        "2.7": "DX 通联、网格定位与竞赛",
        "3.1": "中继、双工器与周边设备",
        "3.2": "收发信机面板（RIT / SDR）",
        "3.3": "天线基础：增益、驻波比与极化",
        "3.4": "天线系统：偶极、八木、行波与天调",
        "3.5": "传输线、电磁波与电离层传播",
        "3.6": "发射调测、必要带宽与接收机指标",
        "3.7": "无线电测向与数据通信",
        "3.8": "卫星通信",
        "4.1": "电工电子基础与电源",
        "4.2": "欧姆定律、功率与交流有效值",
        "4.3": "电路元器件、符号与有源器件",
        "4.6": "测量仪表与 dB 增益",
        "5.1": "安全防护与电磁环境",
    },
}

# C 库在 B 的基础上新增的小节（依据题目内容命名）
SECTIONS["C"] = dict(SECTIONS["B"], **{
    "1.2": "业余无线电台的设置许可与执照",
    "3.2": "收发信机面板与功放接口",
    "4.2": "欧姆定律、功率与交流电路",
    "4.4": "放大电路、失真与整流",
    "4.5": "数字电路与 SDR 基础",
})
CHAPTERS["C"] = dict(CHAPTERS["B"])


def convert(cls):
    src = json.loads((RAW / f"{cls}.json").read_text(encoding="utf-8"))
    out = []
    ids = set()
    for x in src:
        qid = x["id"]
        assert qid not in ids, f"重复 id: {qid}"
        ids.add(qid)
        keys = x["codes"]["P"].split(".")
        section = ".".join(keys[:2])
        assert section in SECTIONS[cls], f"{cls} 缺小节名: {section} ({qid})"
        assert len(x["options"]) == 4, f"{qid} 选项数异常"
        letters = [o["key"] for o in x["options"]]
        assert letters == ["A", "B", "C", "D"], f"{qid} 选项键异常: {letters}"
        img = x.get("imageUrl") or ""
        if img:
            img = "img/" + img.rsplit("/", 1)[1]
        out.append({
            "i": qid,
            "j": x["codes"]["J"],
            "p": x["codes"]["P"],
            "q": x["question"],
            "o": [o["text"] for o in x["options"]],
            "a": [letters.index(k) for k in x["answer_keys"]],
            "e": x.get("explanation") or "",
            "m": x.get("mnemonic") or "",
            "g": img,
        })
    return out


def main():
    BANKS.mkdir(parents=True, exist_ok=True)
    img_dst = BANKS / "img"
    img_dst.mkdir(exist_ok=True)
    copied = 0
    for f in sorted((RAW / "img").glob("*.jpg")):
        shutil.copy2(f, img_dst / f.name)
        copied += 1

    meta_entries = []
    for cls in "ABC":
        qs = convert(cls)
        data = {
            "id": cls.lower(),
            "cls": cls,
            "label": f"{cls} 类",
            "version": "2025-10",
            "rule": RULES[cls],
            "chapters": CHAPTERS[cls],
            "sections": SECTIONS[cls],
            "qs": qs,
        }
        js = ("window.BANKS=window.BANKS||{};"
              f"window.BANKS[{cls.lower()!r}]="
              + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";")
        path = BANKS / f"bank-{cls.lower()}.js"
        path.write_text(js, encoding="utf-8")
        multi = sum(1 for q in qs if len(q["a"]) > 1)
        meta_entries.append((cls, len(qs), multi, path.stat().st_size // 1024))
        print(f"[{cls}] {len(qs)} 题（单选 {len(qs)-multi} / 多选 {multi}）"
              f" -> {path.name} ({path.stat().st_size // 1024} KB)")
    print(f"配图 {copied} 张 -> banks/img/")


if __name__ == "__main__":
    main()
