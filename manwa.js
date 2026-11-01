/** @type {import('./_venera_.js')} */
class Manwa extends ComicSource {
  name = "漫蛙"

  key = "manwa"

  version = "1.0.1"

  minAppVersion = "1.4.0"

  url = "https://cdn.jsdelivr.net/gh/wnzmb/venera-configs-wujiajun@v1.6.1/manwa.js"

  settings = {
    domain: {
      title: "域名（连不上就换一个）",
      type: "select",
      options: [
        { value: "manwarp.cc" },
        { value: "manwarv.cc" },
        { value: "manwart.cc" },
        { value: "manwaro.cc" },
      ],
      default: "manwarp.cc",
    },
  }

  get baseUrl() {
    return "https://" + this.loadSetting("domain")
  }

  // 列表卡片：li > .manga-list-2-cover > a[href=/book/<id>] > img
  //          + .manga-list-2-title > a （标题）
  parseComics(doc) {
    const result = []
    const seen = {}
    for (const a of doc.querySelectorAll("a[href^='/book/']")) {
      const href = a.attributes["href"] || ""
      if (!/^\/book\/\d+$/.test(href)) continue
      const img = a.querySelector("img")
      if (!img || seen[href]) continue
      seen[href] = true
      const titleAttr = a.attributes["title"] || ""
      result.push(new Comic({
        id: href,
        title: titleAttr.trim() || href,
        cover: img.attributes["src"] || img.attributes["data-src"] || "",
        tags: [],
      }))
    }
    return result
  }

  explore = [
    {
      title: this.name,
      type: "multiPageComicList",
      load: async (page) => {
        const url = page <= 1 ? `${this.baseUrl}/booklist` : `${this.baseUrl}/booklist/${page}`
        const res = await Network.get(url, {})
        if (res.status !== 200) throw `Invalid status code: ${res.status}`
        const doc = new HtmlDocument(res.body)
        return { comics: this.parseComics(doc), maxPage: null }
      },
    },
  ]

  search = {
    load: async (keyword, options, page) => {
      const url = `${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`
      const res = await Network.get(url, {})
      if (res.status !== 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)
      return { comics: this.parseComics(doc), maxPage: null }
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

      let cover = ""
      for (const img of doc.querySelectorAll("img")) {
        const src = img.attributes["src"] || img.attributes["data-src"] || ""
        if (src.includes("/cover/")) {
          cover = src
          break
        }
      }

      const tags = {}
      const tagList = []
      for (const a of doc.querySelectorAll("a[href*='/booklist/']")) {
        const t = a.text.trim()
        if (t && t.length < 20) tagList.push(t)
      }
      if (tagList.length) tags["分类"] = tagList.slice(0, 8)

      // 章节：/chapter/<id>
      const chapters = {}
      for (const a of doc.querySelectorAll("a[href^='/chapter/']")) {
        const href = a.attributes["href"] || ""
        const m = href.match(/^\/chapter\/(\d+)$/)
        if (!m) continue
        const name = a.text.trim() || m[1]
        if (chapters[name]) continue
        chapters[name] = href
      }

      return new ComicDetails({
        title: title,
        cover: cover,
        tags: tags,
        chapters: chapters,
        recommend: [],
      })
    },

    loadEp: async (comicId, epId) => {
      const url = epId.startsWith("http") ? epId : this.baseUrl + epId
      const res = await Network.get(url, {})
      if (res.status != 200) throw `Invalid status code: ${res.status}`
      const doc = new HtmlDocument(res.body)

      // 正文图片：<img class="content-img lazy_img" src="占位图"
      //   data-r-src="真实地址" data-original="占位图" data-sort="1">
      // 关键字段是 data-r-src，不是 data-src
      const picked = []
      for (const img of doc.querySelectorAll("img.content-img, .content-img img, img.lazy_img")) {
        const real =
          img.attributes["data-r-src"] ||
          img.attributes["data-src"] ||
          img.attributes["data-original"] ||
          img.attributes["src"] ||
          ""
        if (!real) continue
        if (real.includes("/static/images/")) continue
        const sort = parseInt(img.attributes["data-sort"] || "0") || 0
        picked.push({ sort: sort, url: real })
      }

      picked.sort((a, b) => a.sort - b.sort)
      const images = []
      for (const it of picked) {
        let u = it.url
        if (u.startsWith("//")) u = "https:" + u
        if (!u.startsWith("http")) continue
        if (!images.includes(u)) images.push(u)
      }
      if (!images.length) throw "no images found"
      return { images }
    },

    enableTagsTranslate: false,
  }
}
