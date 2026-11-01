/** @type {import('./_venera_.js')} */
class ThreeHentai extends ComicSource {
  name = "3Hentai"

  // key 不能以数字开头：Venera 会拼成 ComicSource.sources.$key 再执行 JS
  key = "threehentai"

  version = "1.0.1"

  minAppVersion = "1.4.0"

  url = "https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.7.1/3hentai.js"

  // 直连站，不需要 Worker / 密码门
  baseUrl = "https://3hentai.to"

  // 卡片：div.doujin > a.cover[href=/d/<id>/] > img[data-src][alt] + div.title
  // 封面/缩略图在 3-hentai.xyz 或 cdn.3-hentai.xyz，不带 Referer 也能取
  parseCards(doc) {
    const result = []
    const seen = {}
    for (const card of doc.querySelectorAll("div.doujin")) {
      const a = card.querySelector("a[href^='/d/']")
      if (!a) continue
      const href = a.attributes["href"] || ""
      if (!href || seen[href]) continue
      seen[href] = true

      const img = a.querySelector("img")
      const titleEl = card.querySelector("div.title")
      let title = (img && img.attributes["alt"]) || ""
      if (!title && titleEl) title = titleEl.text
      title = (title || "").trim()

      result.push(
        new Comic({
          id: href,
          title: title || href,
          cover: img ? img.attributes["data-src"] || img.attributes["src"] || "" : "",
          tags: [],
        })
      )
    }
    return result
  }

  // 分页条：<nav class="listing-pagination"> … <a class="page" href="/kai?page=26749">26749</a>
  maxPage(doc, fallback) {
    let max = 0
    for (const a of doc.querySelectorAll("a")) {
      const h = a.attributes["href"] || ""
      const m = h.match(/[?&]page=(\d+)/)
      if (m) {
        const n = parseInt(m[1])
        if (n > max) max = n
      }
    }
    return max || fallback
  }

  explore = [
    {
      title: "热门",
      type: "multiPageComicList",
      load: async (page) => {
        const url = `${this.baseUrl}/kai?page=${page}`
        const res = await Network.get(url, {})
        if (res.status !== 200) throw `Invalid status code: ${res.status}`
        const doc = new HtmlDocument(res.body)
        return { comics: this.parseCards(doc), maxPage: this.maxPage(doc, page) }
      },
    },
  ]

  search = {
    load: async (keyword, options, page) => {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(keyword)}&page=${page}`
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)
      return { comics: this.parseCards(doc), maxPage: this.maxPage(doc, page) }
    },
    enableTagsSuggestions: false,
  }

  comic = {
    loadInfo: async (id) => {
      let url = id.startsWith("http") ? id : this.baseUrl + id
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)

      const h1 = doc.querySelector("h1")
      const title = h1 ? h1.text.trim() : ""

      // 封面：详情页有 <a href="/d/<id>/1/"><img src="…/cover.webp">
      let cover = ""
      let mediaId = ""
      for (const img of doc.querySelectorAll("img")) {
        const src = img.attributes["src"] || ""
        const m = src.match(/^https?:\/\/[^/]+\/(\d+)\/cover\.(?:webp|jpg|png)$/)
        if (m) {
          cover = src
          mediaId = m[1]
          break
        }
      }
      // 兜底：从缩略图反推 media id，拼 thumb.webp
      if (!mediaId) {
        for (const img of doc.querySelectorAll("img")) {
          const ds = img.attributes["data-src"] || ""
          const m = ds.match(/^(https?:\/\/[^/]+)\/(\d+)\/\d+t\.(?:webp|jpg)$/)
          if (m) {
            mediaId = m[2]
            if (!cover) cover = `${m[1]}/${m[2]}/cover.webp`
            break
          }
        }
      }

      const tags = {}
      const tagList = []
      for (const a of doc.querySelectorAll("a[href^='/tag/']")) {
        const t = a.text.trim()
        if (t && t.length < 40 && !tagList.includes(t)) tagList.push(t)
      }
      if (tagList.length) tags["标签"] = tagList.slice(0, 24)

      const artists = []
      for (const a of doc.querySelectorAll("a[href^='/artist/']")) {
        const t = a.text.trim()
        if (t && !artists.includes(t)) artists.push(t)
      }
      if (artists.length) tags["作者"] = artists.slice(0, 4)

      return new ComicDetails({
        title: title,
        cover: cover,
        tags: tags,
        chapters: { "全一话": id },
        recommend: [],
      })
    },

    loadEp: async (comicId, epId) => {
      let url = epId.startsWith("http") ? epId : this.baseUrl + epId
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)

      // 详情页把所有页缩略图都渲染出来了：
      //   <img data-src="https://3-hentai.xyz/3553190/70t.webp">
      // 全尺寸 = 去掉文件名里的 t：3553190/70.webp
      const picked = []
      for (const img of doc.querySelectorAll("img")) {
        const ds = img.attributes["data-src"] || img.attributes["src"] || ""
        const m = ds.match(/^(https?:\/\/[^/]+)\/(\d+)\/(\d+)t\.(webp|jpg)$/)
        if (!m) continue
        picked.push({ page: parseInt(m[3]), url: `${m[1]}/${m[2]}/${m[3]}.${m[4]}` })
      }

      if (!picked.length) throw "no images found"
      picked.sort((a, b) => a.page - b.page)

      const images = []
      const seen = {}
      for (const it of picked) {
        if (seen[it.url]) continue
        seen[it.url] = true
        images.push(it.url)
      }
      return { images }
    },

    enableTagsTranslate: false,
  }
}
