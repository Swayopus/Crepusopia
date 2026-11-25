"""生成完整覆盖的网页字体；普通 Astro 构建直接使用已提交的产物。"""

import argparse
import hashlib
import json
import logging
import tempfile
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from io import BytesIO
from pathlib import Path

from fontTools import subset
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
from fontTools.unicodedata import mirrored

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PUBLIC = ROOT / "public/fonts"
MANIFEST = HERE / "manifest.json"
LIMIT = 32 * 1024
# 品牌展示字体只保留英文大小写和空格，与正文分片完全隔离。
TITLE_CHARS = {32, *range(65, 91), *range(97, 123)}
TITLE_SOURCE = "sources/Corinthia-Bold.ttf"
# 常用中文与排版标点先于通用汉字字频排列，避免基础标点落入低频符号分片。
PUNCTUATION = "，。、：；！？“”‘’（）《》〈〉「」『』【】〔〕—…·～←→↑↓↩"
# 两个固定字串分别校准；同一个系数不能同时匹配站点名与首页姓名。
TITLE_SIZE_ADJUST = 149.028246
NAME_SIZE_ADJUST = 138.449871
logging.getLogger("fontTools.subset").setLevel(logging.ERROR)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def cmap(font):
    # 不只读取 BMP 或 getBestCmap：同时核对全部 Unicode 子表。
    return {
        code: glyph
        for table in font["cmap"].tables
        if table.isUnicode()
        for code, glyph in getattr(table, "cmap", {}).items()
    }


def variations(font):
    return {
        (selector, code, glyph)
        for table in font["cmap"].tables
        if table.format == 14
        for selector, entries in table.uvsDict.items()
        for code, glyph in entries
    }


def feature_tags(font):
    return {
        (tag, record.FeatureTag)
        for tag in ("GSUB", "GPOS")
        if tag in font and font[tag].table.FeatureList
        for record in font[tag].table.FeatureList.FeatureRecord
    }


def ranges(codes):
    """精确合并连续码位；不能用包含额外字符的宽泛区间。"""
    result = []
    ordered = sorted(codes)
    for code in ordered:
        if result and code == result[-1][1] + 1:
            result[-1][1] = code
        else:
            result.append([code, code])
    return ",".join(
        f"U+{start:X}" + (f"-{end:X}" if end != start else "") for start, end in result
    )


def glyph_references(value, names):
    """排版查找中的关联字形放在一起，避免拆坏连字、组合符号与字距。"""
    if isinstance(value, str):
        return {value} & names
    if isinstance(value, dict):
        return set().union(
            *(glyph_references(x, names) for pair in value.items() for x in pair)
        )
    if isinstance(value, (list, tuple)):
        return (
            set().union(*(glyph_references(x, names) for x in value))
            if value
            else set()
        )
    return glyph_references(vars(value), names) if hasattr(value, "__dict__") else set()


def groups(font):
    mapping = cmap(font)
    parents = {glyph: glyph for glyph in font.getGlyphOrder()}

    def find(glyph):
        while parents[glyph] != glyph:
            parents[glyph] = parents[parents[glyph]]
            glyph = parents[glyph]
        return glyph

    def join(glyphs):
        glyphs = sorted(glyphs)
        for glyph in glyphs[1:]:
            parents[find(glyph)] = find(glyphs[0])

    glyph_names = set(parents)
    for tag in ("GSUB", "GPOS"):
        if tag in font:
            for lookup in font[tag].table.LookupList.Lookup:
                join(glyph_references(lookup, glyph_names))
    join({glyph for code, glyph in mapping.items() if 32 <= code <= 126})
    # FontTools 会自动补充双向镜像字符；提前合组，避免 CSS 与文件的范围不符。
    for code, glyph in mapping.items():
        other = mirrored(code)
        if other in mapping:
            join({glyph, mapping[other]})
    related = defaultdict(set)
    for code, glyph in mapping.items():
        related[find(glyph)].add(code)
    frequency = PUNCTUATION + (HERE / "chinese-frequency.txt").read_text("utf-8").strip()
    rank = {ord(char): index for index, char in enumerate(dict.fromkeys(frequency))}
    # 使用固定通用字频，不扫描首页/文章；新增内容无需重新生成字体。
    ordered = sorted(
        related.values(),
        key=lambda codes: (
            0 if 65 in codes else 1 if codes & rank.keys() else 2,
            min((rank[code] for code in codes if code in rank), default=min(codes)),
        ),
    )
    batches, batch = [], []
    for unit in ordered:
        if batch and (sum(map(len, batch)) + len(unit) > 192 or len(unit) > 192):
            batches.append(batch)
            batch = []
        batch.append(unit)
    if batch:
        batches.append(batch)
    return batches


def options():
    result = subset.Options()
    result.layout_features = ["*"]
    result.name_IDs = ["*"]
    result.name_languages = ["*"]
    result.glyph_names = True
    result.notdef_outline = True
    result.legacy_kern = True
    # 保留 hinting、版权、命名与全部排版特性，不靠删细节改变字体外观。
    return result


def make_subset(font, codes, extra=()):
    if "glyf" in font and "post" in font and font["post"].formatType == 3.0:
        # 无字形名的 TrueType 原件在重排 GID 后会重新编号。先固定源字形名，
        # 才能逐一核对未编码字形；仅增加名称元数据，不改轮廓和度量。
        font.getGlyphOrder()
        font["post"].formatType = 2.0
        font["post"].extraNames = []
        font["post"].mapping = {}
    tool = subset.Subsetter(options=options())
    selectors = {selector for selector, code, _ in variations(font) if code in codes}
    tool.populate(unicodes=set(codes) | selectors, glyphs=extra)
    tool.subset(font)
    font.flavor = "woff2"
    output = BytesIO()
    font.save(output)
    return output.getvalue()


def emit_batch(task):
    source, units, extra = task
    codes = set().union(*units)
    data = make_subset(TTFont(source, recalcTimestamp=False), codes, extra)
    if len(data) > LIMIT and len(units) > 1:
        middle = len(units) // 2
        return emit_batch((source, units[:middle], extra)) + emit_batch(
            (source, units[middle:], ())
        )
    # 单一排版关联组不能再切，宁可保留稍大的基础片，也不牺牲排版正确性。
    return [(codes, data, len(data) > LIMIT)]


def face(family, file, codes, weight, size_adjust=None):
    adjust = f"  size-adjust: {size_adjust:.6f}%;\n" if size_adjust else ""
    return (
        "@font-face {\n"
        f'  font-family: "{family}";\n'
        f'  src: url("./{file}") format("woff2");\n'
        f"  font-weight: {weight};\n"
        "  font-style: normal;\n"
        "  font-display: swap;\n"
        f"{adjust}"
        f"  unicode-range: {ranges(codes)};\n"
        "}\n"
    )


def entry(file, data, codes, **extra):
    return {
        "file": file,
        "bytes": len(data),
        "sha256": sha(data),
        "unicodeRange": ranges(codes),
        **extra,
    }


def generate(source):
    # 先解码一次，工作进程从 TTF 读取；避免每个分片重复解码整个 WOFF2。
    with tempfile.TemporaryDirectory(prefix="crepusopia-fonts-") as temporary:
        decoded = Path(temporary) / "source.ttf"
        source.flavor = None
        source.save(decoded)
        full = TTFont(decoded, recalcTimestamp=False)
        complete = TTFont(decoded, recalcTimestamp=False)
        tool = subset.Subsetter(options=options())
        tool.populate(unicodes=set(cmap(full)) | {s for s, _, _ in variations(full)})
        tool.subset(complete)
        # 也保留没有独立码位、且不由排版特性引用的原始字形。
        extra = sorted(set(full.getGlyphOrder()) - set(complete.getGlyphOrder()))
        batches = groups(full)
        # 未编码字形无独立码位，放入末尾独立分片，避免撑大首屏预加载的 ASCII 分片或切碎高频汉字。
        if extra and len(batches[-1]) > 1:
            batches.append([batches[-1].pop()])
        tasks = [
            (str(decoded), units, extra if index == len(batches) - 1 else ())
            for index, units in enumerate(batches)
        ]
        generated = []
        with ProcessPoolExecutor(max_workers=4) as pool:
            for index, result in enumerate(pool.map(emit_batch, tasks), 1):
                generated.extend(result)
                if index % 25 == 0 or index == len(tasks):
                    print(f"LXGW: {index}/{len(tasks)} batches", flush=True)

    directory = PUBLIC / "LXGWWenKai/subsets"
    directory.mkdir(parents=True, exist_ok=True)
    entries, css = [], [
        "/* 由 scripts/fonts/subset.py 生成：完整字符覆盖，按 unicode-range 加载。 */\n"
    ]
    for codes, data, oversized in generated:
        filename = f"lxgw-{sha(data)[:16]}.woff2"
        (directory / filename).write_bytes(data)
        entries.append(
            entry(f"LXGWWenKai/subsets/{filename}", data, codes, layoutGroup=oversized)
        )
        css.append(face("LXGW WenKai GB Screen", f"subsets/{filename}", codes, 400))
    (PUBLIC / "LXGWWenKai/font.css").write_text(
        "\n".join(css), encoding="utf-8", newline="\n"
    )
    title = TTFont(HERE / TITLE_SOURCE, recalcTimestamp=False)
    data = make_subset(title, TITLE_CHARS)
    filename = f"corinthia-english-{sha(data)[:16]}.woff2"
    directory = PUBLIC / "Corinthia"
    directory.mkdir(parents=True, exist_ok=True)
    (directory / filename).write_bytes(data)
    write_title_css(filename)
    # 主站构建读取完整声明、按页交付并添加 base；RSS 保持自身相对 URL。
    # 单独输出 URL 版本，避免将 public 内的字体再复制到 _astro/。
    write_main_css()
    return entries, entry(f"Corinthia/{filename}", data, TITLE_CHARS)


def write_title_css(filename):
    # 只注册两个度量别名，浏览器复用同一 WOFF2；不复制字形或增加预加载。
    # 静态 Bold 直接映射至界面的 900，避免合成加粗。
    css = face("Corinthia", filename, TITLE_CHARS, 900, TITLE_SIZE_ADJUST)
    css += face("Corinthia Name", filename, TITLE_CHARS, 900, NAME_SIZE_ADJUST)
    (PUBLIC / "Corinthia/font.css").write_text(
        css, encoding="utf-8", newline="\n"
    )


def write_main_css():
    css = "/* 自动生成，请运行 npm run fonts:generate 更新；不要手工改字表。 */\n"
    for directory in ("LXGWWenKai", "Corinthia"):
        css += (PUBLIC / directory / "font.css").read_text("utf-8").replace(
            'url("./', f'url("/fonts/{directory}/'
        ) + "\n"
    (ROOT / "src/styles/font-subsets.css").write_text(
        css, encoding="utf-8", newline="\n"
    )


def fingerprint(font, glyph):
    pen = RecordingPen()
    font.getGlyphSet()[glyph].draw(pen)
    return sha(
        repr(
            (
                pen.value,
                font["hmtx"][glyph],
                font["vmtx"][glyph] if "vmtx" in font else None,
            )
        ).encode()
    )


def verify(source, manifest):
    """读取实际 WOFF2 复核，不能用生成时的输入列表自证无缺字。"""
    original = cmap(source)
    covered, glyphs, variants, features = {}, set(), set(), set()
    reference = {}
    for index, item in enumerate(manifest["lxgw"]):
        data = (PUBLIC / item["file"]).read_bytes()
        assert sha(data) == item["sha256"], item["file"]
        font = TTFont(BytesIO(data), recalcTimestamp=False)
        mapping = cmap(font)
        assert not covered.keys() & mapping.keys(), f"重复字符: {item['file']}"
        assert ranges(mapping) == item["unicodeRange"], f"CSS 范围不符: {item['file']}"
        assert all(original[code] == glyph for code, glyph in mapping.items()), item[
            "file"
        ]
        assert len(data) <= LIMIT or item["layoutGroup"], item["file"]
        for glyph in font.getGlyphOrder():
            if glyph not in reference:
                reference[glyph] = fingerprint(source, glyph)
            assert (
                fingerprint(font, glyph) == reference[glyph]
            ), f"字形或度量变化: {glyph}"
        for tag, fields in {
            "head": ["unitsPerEm"],
            "hhea": ["ascent", "descent", "lineGap"],
            "OS/2": [
                "sTypoAscender",
                "sTypoDescender",
                "sTypoLineGap",
                "usWinAscent",
                "usWinDescent",
            ],
        }.items():
            assert all(
                getattr(source[tag], key) == getattr(font[tag], key) for key in fields
            )
        covered.update(mapping)
        glyphs.update(font.getGlyphOrder())
        variants.update(variations(font))
        features.update(feature_tags(font))
        if (index + 1) % 50 == 0:
            print(f"Audit: {index + 1}/{len(manifest['lxgw'])} files", flush=True)
    assert covered == original, "LXGW 字符映射存在遗漏或新增"
    assert glyphs == set(source.getGlyphOrder()), "LXGW 原始字形存在遗漏或新增"
    assert variants == variations(source), "LXGW 变体序列存在遗漏或新增"
    assert features == feature_tags(source), "LXGW 排版特性存在遗漏或新增"
    item = manifest["title"]
    data = (PUBLIC / item["file"]).read_bytes()
    assert sha(data) == item["sha256"]
    font = TTFont(BytesIO(data), recalcTimestamp=False)
    original_title = TTFont(HERE / TITLE_SOURCE, recalcTimestamp=False)
    assert set(cmap(font)) == TITLE_CHARS
    for glyph in cmap(font).values():
        assert fingerprint(font, glyph) == fingerprint(original_title, glyph), glyph
    print(
        f"Verified: {len(covered)} Unicode mappings, {len(glyphs)} glyphs, {len(variants)} variation sequences; Corinthia {len(TITLE_CHARS)} characters.",
        flush=True,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="只校验现有分片，不重新生成"
    )
    args = parser.parse_args()
    path = HERE / "sources/LXGWWenKaiGBScreen-all.woff2"
    print("Reading original LXGW font…", flush=True)
    source = TTFont(path, recalcTimestamp=False)
    if args.check:
        manifest = json.loads(MANIFEST.read_text("utf-8"))
        assert manifest["sourceSHA256"] == sha(path.read_bytes())
    else:
        entries, title = generate(source)
        # save() 的解码结果可复用，避免完整审计再次解码原始字库。
        manifest = {
            "sourceSHA256": sha(path.read_bytes()),
            "maxNormalBytes": LIMIT,
            "characterCount": len(cmap(source)),
            "glyphCount": len(source.getGlyphOrder()),
            "variationCount": len(variations(source)),
            "lxgw": entries,
            "title": title,
        }
    verify(source, manifest)
    if not args.check:
        MANIFEST.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        keep = {
            PUBLIC / item["file"] for item in [*manifest["lxgw"], manifest["title"]]
        }
        # 仅清理本工具生成的旧产物；完整原件留在 sources，不参与发布。
        for pattern in (
            "LXGWWenKai/subsets/lxgw-*.woff2",
            "Corinthia/corinthia-english-*.woff2",
        ):
            for file in PUBLIC.glob(pattern):
                if file not in keep:
                    file.unlink()


if __name__ == "__main__":
    main()
