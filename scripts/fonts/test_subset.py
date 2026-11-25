"""回归：无字形名的字体裁剪后，未编码字形仍能按源身份核对。"""

import unittest
from io import BytesIO

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

from subset import cmap, fingerprint, groups, make_subset


class UnnamedGlyphTest(unittest.TestCase):
    def test_unencoded_glyph_survives_gid_reordering(self):
        builder = FontBuilder(1000, isTTF=True)
        names = [".notdef", "A", "unencoded", "B"]
        builder.setupGlyphOrder(names)
        builder.setupCharacterMap({65: "A", 66: "B"})
        glyphs = {}
        for index, name in enumerate(names):
            pen = TTGlyphPen(None)
            pen.moveTo((0, 0))
            pen.lineTo((100 + index * 20, 0))
            pen.lineTo((0, 500))
            pen.closePath()
            glyphs[name] = pen.glyph()
        builder.setupGlyf(glyphs)
        builder.setupHorizontalMetrics({name: (600, 0) for name in names})
        builder.setupHorizontalHeader(ascent=800, descent=-200)
        builder.setupNameTable({"familyName": "Subset Test", "styleName": "Regular"})
        builder.setupOS2(sTypoAscender=800, sTypoDescender=-200)
        builder.setupPost(keepGlyphNames=False)
        buffer = BytesIO()
        builder.save(buffer)

        original = TTFont(BytesIO(buffer.getvalue()))
        self.assertEqual(original["post"].formatType, 3.0)
        orphan = original.getGlyphName(2)
        expected = fingerprint(original, orphan)
        # 丢弃 A，令后面两个字形的 GID 前移；字形名必须仍指向源字形。
        data = make_subset(TTFont(BytesIO(buffer.getvalue())), {66}, extra=[orphan])
        result = TTFont(BytesIO(data))
        self.assertNotEqual(result.getGlyphID(orphan), original.getGlyphID(orphan))
        self.assertEqual(set(result.getGlyphOrder()), {".notdef", orphan, "B"})
        self.assertEqual(cmap(result), {66: "B"})
        self.assertEqual(fingerprint(result, orphan), expected)

    def test_cff_glyph_names_do_not_need_post_conversion(self):
        # CFF 自带字形名；只有 post 3.0 的无名 TrueType 才需要先补字形名。
        builder = FontBuilder(1000, isTTF=False)
        names = [".notdef", "A"]
        builder.setupGlyphOrder(names)
        builder.setupCharacterMap({65: "A"})
        strings = {}
        for name in names:
            pen = T2CharStringPen(600, None)
            pen.moveTo((0, 0))
            pen.lineTo((100, 0))
            pen.lineTo((0, 500))
            pen.closePath()
            strings[name] = pen.getCharString()
        builder.setupCFF("Subset-Test", {"FullName": "Subset Test"}, strings, {})
        builder.setupHorizontalMetrics({name: (600, 0) for name in names})
        builder.setupHorizontalHeader(ascent=800, descent=-200)
        builder.setupNameTable({"familyName": "Subset Test", "styleName": "Regular"})
        builder.setupOS2(sTypoAscender=800, sTypoDescender=-200)
        builder.setupPost()
        buffer = BytesIO()
        builder.save(buffer)

        original = TTFont(BytesIO(buffer.getvalue()))
        self.assertEqual(original["post"].formatType, 3.0)
        data = make_subset(TTFont(BytesIO(buffer.getvalue())), {65})
        result = TTFont(BytesIO(data))
        self.assertEqual(result["post"].formatType, 3.0)
        self.assertEqual(fingerprint(result, "A"), fingerprint(original, "A"))

    def test_chinese_punctuation_is_ranked_before_unranked_symbols(self):
        builder = FontBuilder(1000, isTTF=True)
        names = [".notdef", "A", "comma", "han", "rare"]
        builder.setupGlyphOrder(names)
        builder.setupCharacterMap({65: "A", 0xFF0C: "comma", 0x7684: "han", 0x2603: "rare"})
        glyphs = {}
        for name in names:
            pen = TTGlyphPen(None)
            pen.moveTo((0, 0))
            pen.lineTo((100, 0))
            pen.lineTo((0, 500))
            pen.closePath()
            glyphs[name] = pen.glyph()
        builder.setupGlyf(glyphs)
        builder.setupHorizontalMetrics({name: (600, 0) for name in names})
        builder.setupHorizontalHeader(ascent=800, descent=-200)
        builder.setupNameTable({"familyName": "Subset Test", "styleName": "Regular"})
        builder.setupOS2(sTypoAscender=800, sTypoDescender=-200)
        builder.setupPost()
        buffer = BytesIO()
        builder.save(buffer)

        batches = groups(TTFont(BytesIO(buffer.getvalue())))
        self.assertEqual(batches, [[{65}, {0xFF0C}, {0x7684}, {0x2603}]])


if __name__ == "__main__":
    unittest.main()
