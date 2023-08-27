const axios =require('axios');
const stream = require('stream');
const { promisify } = require('util');
const fs = require('fs-extra');
const jsdom = require("jsdom");
const json5 = require('json5');
const { JSDOM } = jsdom;
require('dotenv').config()
	
const cookie = process.env.COOKIE;
async function commonRequest(url) {
  while (true) {
    try {
      return await axios.request({
        url,
        headers: {
          Host: 'maoistlegacy.de',
          'User-Agent':
            'AMD',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Referer: 'https://maoistlegacy.de',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': 1,
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          DNT: 1,
          'Sec-GPC': 1,
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache',
          TE: 'trailers',
          Cookie: cookie,
        },
      });
    } catch (e) {
      console.log('request faild, retry');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function doGetDetail(link_path) {
    return await commonRequest('https://maoistlegacy.de' + link_path);
}

async function doGetListData(page) {
  return await commonRequest('https://maoistlegacy.de/db/items?page=' + page);
}

async function getListData(page) {
  const r = await doGetListData(page);
  const dom = new JSDOM(r.data);
  const res = [];
  dom.window.document.querySelectorAll('.hentry').forEach((item) => {
    const title = item.querySelector('h2 a').textContent;
    const link = item.querySelector('h2 a').href;

    const data = {
      title,
      link,
      /**
       * identifier: string
       * tags: string[]
       * creator: string[]
       * subject: string[]
       * dates: {year: number, month: number, day: number}[]
       */
    };
    item.querySelectorAll('.item-meta .Date').forEach((meta) => {
      const type = meta
        .querySelector('strong')
        .textContent.replace(':', '')
        .toLowerCase();

      let value;
      if (type === 'creator' || type === 'tags' || type === 'subject') {
        value = [];
        meta
          .querySelectorAll('a')
          .forEach((a) => value.push(a.textContent.trim()));
      } else if (type === 'date') {
        value = meta.childNodes[1].textContent
          .trim()
          .replace(/ /g, ' ')
          .replace(/ +/g, ',')
          .split(',')
          .map((i) => {
            const [year, month, day] = i.split('-');
            return {
              year: parseInt(year),
              month: parseInt(month) || undefined,
              day: parseInt(day) || undefined,
            };
          });
      } else {
        value = meta.childNodes[1].textContent.trim();
      }
      data[type] = value;
    });
    res.push(data);
  });
  return res;
}

async function getTotalPage() {
  const r = await doGetListData(1);
  const dom = new JSDOM(r.data);
  return Math.ceil(parseInt(
    dom.window.document
      .querySelector('h1')
      .textContent.replace(/\D/g, ''),
  ) / 25);
}
async function getDetails(link) {
  const r = await doGetDetail(link);
  const dom = new JSDOM(r.data);
  const content = dom.window.document.querySelector(
    '#text-item-type-metadata-text .element-text',
  ) || dom.window.document.querySelector(
    '#trans-display',
  );
  const iframe = dom.window.document.querySelector('iframe');
  const img_container = dom.window.document.querySelector('#my-fotorama');
  const primary_script = dom.window.document.querySelector('#primary script');

  const identifier = Array.from(
      dom.window.document.querySelectorAll('#dublin-core-identifier .element-text'),
    ).map((i) => i.textContent);
  return {
    imgs: img_container
      ? json5
          .parse(
            primary_script.textContent.slice(
              primary_script.textContent.indexOf('['),
              primary_script.textContent.indexOf(']') + 1,
            ),
          )
          .map((i) => i.img)
      : [],
    pdf: iframe
      ? 'https://maoistlegacy.de' + iframe.src.split('file=')[1]
      : undefined,
    collection: Array.from(
      dom.window.document.querySelectorAll(
        '#dublin-core-collection .element-text',
      ),
    ).map((i) => i.textContent),
    subject: Array.from(
      dom.window.document.querySelectorAll('#dublin-core-subject a'),
    ).map((i) => i.textContent),
    identifier: identifier.length ? identifier : undefined,
    coverage: Array.from(
      dom.window.document.querySelectorAll(
        '#dublin-core-coverage .element-text',
      ),
    ).map((i) => i.textContent),
    format: Array.from(
      dom.window.document.querySelectorAll('#dublin-core-format .element-text'),
    ).map((i) => i.textContent),
    publisher: Array.from(
      dom.window.document.querySelectorAll(
        '#dublin-core-publisher .element-text',
      ),
    ).map((i) => i.textContent),
    source: Array.from(
      dom.window.document.querySelectorAll('#dublin-core-source .element-text'),
    ).map((i) => i.textContent),
    title: dom.window.document.querySelector('#dublin-core-title .element-text')
      ?.textContent,
    tags: Array.from(dom.window.document.querySelectorAll('.hTagcloud a')).map(
      (i) => i.textContent,
    ),
    creator: Array.from(
      dom.window.document.querySelectorAll('#dublin-core-creator a'),
    ).map((i) => i.textContent),
    dates: Array.from(
      dom.window.document.querySelectorAll('#dublin-core-date .element-text'),
    ).map((i) => {
      return {
        year: parseInt(i.textContent.split('-')[0]),
        month: parseInt(i.textContent.split('-')[1]) || undefined,
        day: parseInt(i.textContent.split('-')[2]) || undefined,
      };
    }),
    contributor: Array.from(
      dom.window.document.querySelectorAll(
        '#dublin-core-contributor .element-text',
      ),
    ).map((i) => i.textContent),
    parts: content
      ? Array.from(content.childNodes)
          .filter((i) => i.tagName)
          .map((i) => {
            return {
              type:
                i.tagName === 'H2'
                  ? 'title'
                  : i.tagName === 'P'
                  ? i.getAttribute('style')
                    ? 'subtitle'
                    : 'paragraph'
                  : 'paragraph',
              text: i.textContent.trim(),
            };
          })
          .filter((i) => i.text)
      : [],
  };
}

async function downloadFile(url, filePath) {
  while (true) {
    try {
      return await new Promise((resolve, reject) => {
        axios
          .get(url, { responseType: 'stream' })
          .then((response) => {
            response.data
              .pipe(fs.createWriteStream(filePath))
              .on('finish', () => {
                resolve(); // 下载完成时 resolve
              })
              .on('error', (err) => {
                console.log(err);
                reject(err); // 下载失败时 reject
              });
          })
          .catch((error) => {
            reject(error); // 发生错误时 reject
          });
      });
    } catch (e) {
      console.log(url, 'download faild, retry');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

(async () => {
  const total = await getTotalPage();
  const meta_data = [];
  for (let i = 1; i <= total; i++) {
    console.log('load page ' + i + '/' + total);
    const list_data = await getListData(i)
    meta_data.push(...list_data);
    for (const j of list_data) {
      const id = j.link.replace(/\D/g, '');
      console.log('load ' + id);

      if (await fs.existsSync(`./data/${id}/done`)) {
        console.log(`skip ${id}`);
        continue;
      }
      const details = await getDetails(j.link);
      await fs.ensureDir(`./data/${id}`);
      await fs.writeJSON(`./data/${id}/meta.json`, details);
      if (details.imgs.length) {
        let idx = 1;
        for (const img of details.imgs) {
          console.log('download img ' + idx)
          await downloadFile(
            'https://maoistlegacy.de' + img,
            `./data/${id}/${idx}.${img.split('.').pop()}`,
          );
          ++idx;
        }
      }

      if (details.pdf) {
        console.log('download pdf ' + id);
        await downloadFile(details.pdf, `./data/${id}/${id}.pdf`);
      }
      await fs.writeFile(`./data/${id}/done`, '1');
    }
    console.log('done')
  }
})();