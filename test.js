const fs = require('fs-extra')
const dir_list = fs.readdirSync('./data');

const x_set = new Set();
let a = 0, b = 0, c = 0;
for (const dir of dir_list) {
  const meta = fs.readJSONSync(`./data/${dir}/meta.json`);
  if (meta.imgs.length && !meta.parts.length) {
    ++a
  } else if ((meta.pdf || meta.imgs.length) && meta.parts.length) {
    ++b;
    console.log(meta.title, dir)
  } else if (!meta.pdf && !meta.imgs.length && meta.parts.length) {
    ++c;
  }
  // for (const i of meta.tags) {
  //   x_set.add(i);
  // }
}
console.log(a, b, c);
console.log(x_set);