/** @type {import('./_venera_.js')} */
class Imhentai extends ComicSource {
  name = "IMHentai"

  key = "imhentai"

  version = "1.0.0"

  minAppVersion = "1.4.0"

  url = "https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.7.0/imhentai.js"

  // 直连站，不需要 Worker / 密码门
  baseUrl = "https://imhentai.to"

  // 卡片：div.inner_thumb > a[href=/g/<id>/] > img[data-src][alt]
  // 每个卡片有两个指向同一 /g/<id>/ 的 <a>，按 href 去重
  parseCards(doc) {
    const result = []
    const seen = {}
    for (const a of doc.querySelectorAll("a[href^='/g/']")) {
      const href = a.attributes["href"] || ""
      if (!/^\/g\/\d+\/?$/.test(href) || seen[href]) continue

      const img = a.querySelector("img")
      if (!img) continue
      seen[href] = true

      const title = (img.attributes["alt"] || "").trim()
      result.push(
        new Comic({
          id: href,
          title: title || href,
          cover: img.attributes["data-src"] || img.attributes["src"] || "",
          tags: [],
        })
      )
    }
    return result
  }

  // 分页条：<ul class="pagination"> … <a class="page-link" href="…/popular?page=27861">
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
        const url = `${this.baseUrl}/popular?page=${page}`
        const res = await Network.get(url, {})
        if (res.status !== 200) throw `Invalid status code: ${res.status}`
        const doc = new HtmlDocument(res.body)
        return { comics: this.parseCards(doc), maxPage: this.maxPage(doc, page) }
      },
    },
    {
      title: "高分",
      type: "multiPageComicList",
      load: async (page) => {
        const url = `${this.baseUrl}/top-rated?page=${page}`
        const res = await Network.get(url, {})
        if (res.status !== 200) throw `Invalid status code: ${res.status}`
        const doc = new HtmlDocument(res.body)
        return { comics: this.parseCards(doc), maxPage: this.maxPage(doc, page) }
      },
    },
  ]

  search = {
    // 注意：q 必须每页都带上，否则第 2 页起会退化成首页列表
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

      // 封面：详情页有 <img src="https://supercdn.site/galleries/<mid>/cover.webp">
      let cover = ""
      let mediaId = ""
      for (const img of doc.querySelectorAll("img")) {
        const src = img.attributes["src"] || ""
        const m = src.match(/^(https?:\/\/[^/]+\/galleries\/\d+)\/cover\.(?:webp|jpg|png)$/)
        if (m) {
          cover = src
          mediaId = m[1]
          break
        }
      }
      if (!mediaId) {
        for (const img of doc.querySelectorAll("img")) {
          const ds = img.attributes["data-src"] || ""
          const m = ds.match(/^(https?:\/\/[^/]+\/galleries\/\d+)\/\d+t\.(?:webp|jpg)$/)
          if (m) {
            if (!cover) cover = `${m[1]}/cover.webp`
            break
          }
        }
      }

      // 标签文字带数量后缀（"lolicon 19K"），要去掉
      const clean = (t) => t.replace(/\s+\d+(?:\.\d+)?[KM]?$/, "").trim()

      const tags = {}
      const tagList = []
      for (const a of doc.querySelectorAll("a[href^='/tag/']")) {
        const t = clean(a.text)
        if (t && t.length < 40 && !tagList.includes(t)) tagList.push(t)
      }
      if (tagList.length) tags["标签"] = tagList.slice(0, 24)

      const artists = []
      for (const a of doc.querySelectorAll("a[href^='/artist/']")) {
        const t = clean(a.text)
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

      // 详情页含全部页缩略图：
      //   <img data-src="https://supercdn.site/galleries/4288638/1t.webp">
      // 全尺寸 = 去掉文件名里的 t：4288638/1.webp
      const picked = []
      for (const img of doc.querySelectorAll("img")) {
        const ds = img.attributes["data-src"] || img.attributes["src"] || ""
        const m = ds.match(/^(https?:\/\/[^/]+\/galleries\/\d+)\/(\d+)t\.(webp|jpg)$/)
        if (!m) continue
        picked.push({ page: parseInt(m[2]), url: `${m[1]}/${m[2]}.${m[3]}` })
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
