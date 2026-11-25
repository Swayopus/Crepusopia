# 字体分片的输入与生成方式

`subset.py` 用于字体更新时离线生成完整分片。常规 `npm run build` 不需要 Python：内页使用已提交的完整分片，首页则由 `scripts/resource-delivery.mjs` 调用 HarfBuzz 按当前页面文字生成附加子集，写入 `dist/_astro/`。新增文章改变首页摘要时，该附加子集会在普通构建中自动更新；完整分片不随文章重新生成。

- `sources/LXGWWenKaiGBScreen-all.woff2`：工具使用的完整源字库副本，目前为用户提供的 `LXGWWenKaiGBScreen.woff2`，版本 1.530（2026-10-19），SHA-256 为 `2acd2d226f42940410f6c4cd5e0758df5ed58de6d28d4a1dfbdf0737651264b2`。固定的 `-all` 文件名用于生成工具，不表示使用旧版字库。字符、变体序列、字形轮廓和水平/垂直度量以这份新原件为准。版权与 SIL OFL 1.1 条款见 `public/fonts/LXGWWenKai/OFL.txt`，字体内部版权信息也保留。
- `sources/Corinthia-Bold.ttf`：品牌展示字体，Corinthia Bold（The Corinthia Project Authors），SIL OFL 1.1，可自托管与子集化。仅裁剪为英文大小写和空格共 53 个字符，保留原始字形与字距；许可全文随站点发布于 `public/fonts/Corinthia/OFL.txt`。同一个 WOFF2 注册两个度量别名：站点名称 `Corinthia` 为 `size-adjust: 149.028246%`，首页姓名 `Corinthia Name` 为 `138.449871%`；不能用站点名字宽推断姓名也已匹配。后者按 2000×1200 旧版姓名宽度 360.59375px 校准，保留原有 CSS 字号、行高和字距。
- 原先使用的 Snell Roundhand Black 由 Matthew Carter 设计，版权与商标归 Monotype/Linotype 所有，不具备自托管的 Webfont 再分发授权。它已在 2026-10-27 从 `sources/`、`public/`、生成工具和站点产物中全部删除，仓库内不再保留该字体的任何二进制；不要再把它加回项目。
- `chinese-frequency.txt`：从 [forfudan/chinese-characters-frequency](https://github.com/forfudan/chinese-characters-frequency) 的“六億知乎語料通規漢字字頻表”提取 `char` 列，按 `count` 降序排列，共 7,423 个字符。只用于排列分片，不限制字符覆盖；没有出现在字频表的原字体字符也会全部生成。
- 字频原表：[CSV](https://github.com/forfudan/chinese-characters-frequency/blob/main/tables/六億知乎語料通規漢字字頻表.csv)，SHA-256 为 `3dd2c03af6cdf04b049b28c20d792be4ccc6f271b11ab150f5bc0523f0ee0399`。派生字序文件 SHA-256 为 `bc3e23babe90283d371ca7778e729a72225e8cd9bedcc8699ff5b9b2316d0ab6`。作者 forfudan，原表与派生数据遵循 Apache-2.0，完整条款见 `FREQUENCY-LICENSE`。

## 生成和校验

```sh
python -m pip install -r scripts/fonts/requirements.txt
npm run fonts:generate
npm run fonts:check
```

生成完成前会读取实际 WOFF2 文件，核对全部 Unicode 映射、变体序列、原始字形合集、轮廓和度量。校验通过后才写入 `manifest.json`。`--check` 会独立重复完整字体审计；普通构建检查则核对文件哈希、CSS 范围和发布副本，不要求安装 Python。

对于未保存字形名称的 TrueType 原件（`glyf` 加 `post` 3.0），工具会在裁剪前固定字形名称并写入分片，避免未编码字形在 GID 重排后被误认。该处理只增加名称元数据，轮廓、字符映射和度量仍逐一与原件比较；CFF 字体自身已有名称，不做此转换。对应回归测试可运行 `python -m unittest discover -s scripts/fonts -p "test_*.py"`。

LXGW 的常规分片不超过 32 KiB；原字体排版查找关联的字符作为不可拆的单元保留，较大的单个关联组在 manifest 中标为 `layoutGroup`。保留 hinting 和排版特性，不为追求体积删除字形细节。所有分片采用同一家族名和精确 `unicode-range`，由浏览器按用字请求，未预加载全部分片。字体原件位于 `scripts/`，不会复制到 `dist/`。

`src/styles/font-subsets.css` 是主站构建的完整声明输入，不直接并入阻塞布局样式。内页按最终文字内联需要的已有分片声明，并低优先级加载共享完整声明；首页生成附加子集，以独立家族 `LXGW WenKai GB Screen Home` 注册，仅在动态文本需要时加载完整声明。原有完整分片和全字库覆盖保持不变。动态一言通过 `src/scripts/font-loading.ts` 按首页实际 Unicode 范围分流，避免显式加载时重复请求完整分片中的已覆盖字符。RSS 继续使用 public 下的相对路径版本。实现与无 JavaScript 回退见 `scripts/resource-delivery.mjs`。

品牌回退在 `src/styles/font.css` 中按站点名/姓名、Arial（兼容 Liberation Sans）/Roboto 分别匹配字宽与行框。Roboto 字宽参考官方 [Roboto Regular 样本](https://github.com/googlefonts/roboto-2/blob/main/src/hinted/Roboto-Regular.ttf)；本地字体版本及栅格化舍入仍可能有差异，不能视为所有系统逐像素相同。首页姓名用 `inline-block` 优先整体断行，避免各单词宽度比例不同而改变断行；极窄容器仍可内部换行，没有固定高度或裁剪。更改品牌文字或源字体后，需要重新校准并测试临界宽度、冷缓存字体切换。

“完整覆盖”指字符映射、变体序列及原有字形/度量的完整保留，不指 WOFF2 文件的字节拼接等同原文件。分片会产生重复的字体表和必要的字形依赖，全部文件总和可能比原件更大。单页是否更快、Lighthouse 是否满分，需要结合实际加载的分片数量、网络与页面其他资源测量。
