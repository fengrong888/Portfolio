#!/bin/bash
# 预览单文件构建：同步源码 -> 替换图片为公网URL/字体镜像 -> 构建 -> 内联 dist 为 /tmp/preview.html
set -e
SRC=/home/user/Doubao/chats/38443466141312002/portfolio-site
BUILD=/tmp/preview-build
rm -rf "$BUILD"
mkdir -p "$BUILD"
rsync -a --exclude node_modules --exclude dist --exclude .git --exclude scripts "$SRC"/ "$BUILD"/
cd "$BUILD"
python3 - <<'PYEOF'
import re
m = {
'work-01.jpg':'4NgxmjAjbT','work-02.jpg':'oExIRll5Kd','work-03.jpg':'O9BWWBZhDg','work-04.jpg':'vHu7o43VJu',
'work-05.jpg':'M7OUpERFez','work-06.jpg':'c9zKScthEk','work-07.jpg':'LCVi2sKJ4X','work-08.jpg':'elvUWHJyXv',
'work-09.jpg':'G6W7D27M4V','work-10.jpg':'3HZo9LJqUY','work-11.jpg':'YAXs6k3f7G','work-12.jpg':'jqkskjWZZh',
'work-13.jpg':'HWTH3HcDGZ','work-14.jpg':'UZXdSzV8GV','work-15.jpg':'sW9eDpNt1E','work-16.jpg':'VviZ5EoaFh',
'work-17.jpg':'o3gM6U81VP','work-18.jpg':'t8ZyNzghk7','work-19.jpg':'DqrYW1RU4d','work-20.jpg':'1VUWmkSBsk',
'work-01-a.jpg':'s9PH9XXJ9r','work-01-b.jpg':'WQkMINJYfh','work-01-c.jpg':'fbHNvXuO5s','work-01-d.jpg':'4sPRI11KkY',
'work-01-e.jpg':'1Fj8aerx50','work-01-f.jpg':'3XIfLxKx5A','work-01-g.jpg':'zM8ULUenpX','work-01-h.jpg':'7n1p2AgM1E','work-01-i.jpg':'E4VxVY4UCa',
'work-02-a.jpg':'nADkbcf23W','work-02-b.jpg':'ouEw66fZ6i','work-02-c.jpg':'LEunbvzOVM','work-02-d.jpg':'2wjL2s4vpP','work-02-e.jpg':'I4dFnfFh8a',
'work-03-a.jpg':'cFIGwwDiRe','work-03-b.jpg':'8FeOtimXbk','work-03-c.jpg':'DI8AawRzv7','work-03-d.jpg':'j5nPWrAArP',
'work-03-e.jpg':'qPNc28Bowv','work-03-f.jpg':'7xdMdZAgId','work-03-g.jpg':'FPHrpCsZnA','work-03-h.jpg':'5onHD30G8k',
'work-03-i.jpg':'8qioYE2xoR','work-03-j.jpg':'7vovJQ3mqV','work-03-k.jpg':'cHc27xZ2bl','work-03-l.jpg':'or3OEPKzYo',
'work-03-m.jpg':'DJhJC6ZfSg','work-03-n.jpg':'8rzrnSs8QB','work-03-o.jpg':'KRrVcDeV55','work-03-p.jpg':'BFkPHH6NAe',
'work-04-a.jpg':'lZBjRZQmes','work-04-b.jpg':'anmyEPhzdn','work-04-c.jpg':'KUfnVh4uVg','work-04-d.jpg':'htLKM4qUIV',
'work-04-e.jpg':'rCIhZ6UA16','work-04-f.jpg':'3U9IoX69nC','work-04-g.jpg':'7mNp2TuYbZ','work-04-h.jpg':'Jrj2AFV96L',
'work-04-i.jpg':'37q1B82qgA','work-04-j.jpg':'UlPnkiNkUm','work-04-k.jpg':'XCluJphVdR','work-04-l.jpg':'fKDEph0RNs',
'work-04-m.jpg':'B8JprblBi0','work-04-n.jpg':'nhWIZakcAA','work-04-o.jpg':'d627wSuvOG',
'work-05-a.jpg':'KHLM3UoXW9','work-05-b.jpg':'FVlw9bNTjg','work-05-c.jpg':'hcISXV3Tvx','work-05-d.jpg':'rM8ISaA2Z6',
'work-05-e.jpg':'3lBy7FHgfi','work-05-f.jpg':'dECHUecROk','work-05-g.jpg':'nwyS7JKEbb','work-05-h.jpg':'5CceRrMni9','work-05-i.jpg':'4rQopQuadI',
'work-06-a.jpg':'ujESrrUqmR','work-06-b.jpg':'qru9NDAbqX','work-06-c.jpg':'bZ8aq9SBxe','work-06-d.jpg':'NUaXKvfLXS',
'work-06-e.jpg':'1X6eXQeGUw','work-06-f.jpg':'SEO1YPgSzT',
'work-07-a.jpg':'YC2zzBOxNU','work-07-b.jpg':'x86iGj1dfS','work-07-c.jpg':'nvDaBYefb6',
'work-08-a.jpg':'DolOfsyXH7','work-08-b.jpg':'gMORIgJU5O','work-08-c.jpg':'tFZjGqW8it','work-08-d.jpg':'IO7ttu8y9F','work-08-e.jpg':'Ars8j1J7H6',
'work-09-a.jpg':'87XyHljVZS','work-09-b.jpg':'F7VtOl1QiU','work-09-c.jpg':'zyoC4f75IZ','work-09-d.jpg':'qCVSvcFERx','work-09-e.jpg':'1uDg7MW6v6',
'work-10-a.jpg':'zF4ioBRLUa','work-10-b.jpg':'UAWq6PDqAa','work-10-c.jpg':'sxIEvU5vVW','work-10-d.jpg':'wGmcIeokp3','work-10-e.jpg':'b0JJsA8E0q','work-10-f.jpg':'6hqrx1b4sq',
'work-11-a.jpg':'EZgU8Gubut','work-11-b.jpg':'QDSE44NGVA','work-11-c.jpg':'aJ23RUT1xx','work-11-d.jpg':'KKiksdIhZX',
'work-11-e.jpg':'9wpQl5huOA','work-11-f.jpg':'gAIUB0TskR','work-11-g.jpg':'BnB7FEQUva','work-11-h.jpg':'OUpra7HnkD',
'work-12-a.jpg':'zrtD8dNnx0','work-12-b.jpg':'E9iidmB2M3','work-12-c.jpg':'c2bkx9Xopr','work-12-d.jpg':'c21bKwJG9i',
'work-12-e.jpg':'oBFWtjASey','work-12-f.jpg':'Ym4mscIxhS','work-12-g.jpg':'XUX9cMQ92U','work-12-h.jpg':'XyLrVKSh67',
'work-13-a.jpg':'7EA2m97efn','work-13-b.jpg':'jjVGU80fJE','work-13-c.jpg':'5QlhCOYsCs','work-13-d.jpg':'hbgdkkHqJt',
'work-13-e.jpg':'3CU5agQ5IA','work-13-f.jpg':'OlpjVJMHBr',
'work-14-a.jpg':'TXMIV8zvLs','work-14-b.jpg':'HBsLz4qQl3','work-14-c.jpg':'oIM5LbmrUx','work-14-d.jpg':'FEmI7q3vkS',
'work-14-e.jpg':'eH1xV8RCBN','work-14-f.jpg':'henF6SziHi','work-14-g.jpg':'rwft45jjTo',
'work-15-a.jpg':'Z5Xk9HK05y','work-15-b.jpg':'iCnVKeGdzZ','work-15-c.jpg':'Gg7fbicevb','work-15-d.jpg':'1lmqFw4uFj',
'work-15-e.jpg':'27v8BXg1wF','work-15-f.jpg':'zI1FnJg1bI','work-15-g.jpg':'wLUSI3Gm2z',
'work-16-a.jpg':'Nwk6GlX9uc','work-16-b.jpg':'NI7ZOdVrp3','work-16-c.jpg':'dR1KEiUpD4','work-16-d.jpg':'A2Mypa6ZUe',
'work-16-e.jpg':'LTzcfodUPs','work-16-f.jpg':'QH25ZfjuTG','work-16-g.jpg':'li8JlWv0mH','work-16-h.jpg':'jwgpbLfCLI',
'work-16-i.jpg':'8r16zxl8AY','work-16-j.jpg':'MtmhjfvspH','work-16-k.jpg':'LpU2H5ULBz','work-16-l.jpg':'1gP3brC2KM',
'work-16-m.jpg':'EWEhs5KVeI','work-16-n.jpg':'RnTbEXs7fY',
'work-17-a.jpg':'NEhHoqAydl','work-17-b.jpg':'qpyPCitKEB','work-17-c.jpg':'44Y7mSGKck','work-17-d.jpg':'YhjS5LBCfa',
'work-18-a.jpg':'WVg19eoINt','work-18-b.jpg':'5st9KrBGNo','work-18-c.jpg':'lRBlviKZYR','work-18-d.jpg':'5PDlikIaAm',
'work-19-a.jpg':'bpS9Lr7HPM','work-19-b.jpg':'3g2c79ks5d','work-19-c.jpg':'hwp9PSTwvX','work-19-d.jpg':'fV7bcW4jYm',
'work-19-e.jpg':'B888goBPvk','work-19-f.jpg':'7AjlaNJfQp','work-19-g.jpg':'8jstw17GFZ',
'work-20-a.jpg':'BSpl9WSjjK','work-20-b.jpg':'9qb5SzVg0M','work-20-c.jpg':'g6Co7UPESm','work-20-d.jpg':'xXGklI1qWi','work-20-e.jpg':'96kuVLrT23',
}


f='src/data/works.js'; s=open(f).read()
for k,v in m.items():
    s=s.replace(f"/works/{k}", f"https://aka.doubaocdn.com/s/{v}")
open(f,'w').write(s)
g='src/components/About.jsx'; s=open(g).read()
s=s.replace('/portrait.jpg','https://aka.doubaocdn.com/s/5movVNVsHW')
s=s.replace('/brand-wall.jpg','https://aka.doubaocdn.com/s/UIfvtODrjs')
s=s.replace('/brand-wall.png','https://aka.doubaocdn.com/s/CViwOJGYhz')
s=s.replace('/brands-top.jpg','https://aka.doubaocdn.com/s/Yq9gFd0PPx')
s=s.replace('/wall-1.jpg','https://aka.doubaocdn.com/s/GB27owdmFq')
s=s.replace('/wall-2.jpg','https://aka.doubaocdn.com/s/R6U8qyMSUQ')
open(g,'w').write(s)
h='index.html'; s=open(h).read()
s=s.replace('https://fonts.googleapis.com/css2','https://miaoda.feishu.cn/fonts/css2')
s=re.sub(r'<link rel="preconnect"[^>]*>','',s)
open(h,'w').write(s)
print('replace ok')
PYEOF
npm install --no-audit --no-fund 2>&1 | tail -1
npm run build 2>&1 | grep -E "error|index-.*(js)" | head -2
node - <<'NODEEOF'
const fs = require('fs'), path = require('path');
const dist = '/tmp/preview-build/dist';
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const assets = path.join(dist, 'assets');
const files = fs.readdirSync(assets);
const css = fs.readFileSync(path.join(assets, files.find(f => f.endsWith('.css'))), 'utf8');
const js = fs.readFileSync(path.join(assets, files.find(f => f.endsWith('.js'))), 'utf8');
html = html.replace(/<link[^>]*href="\.\/assets\/[^"]*\.css"[^>]*>/, () => `<style>${css}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/assets\/[^"]*\.js"[^>]*><\/script>/, () => `<script type="module">${js}</script>`);
fs.writeFileSync('/tmp/preview.html', html);
console.log('inlined', (html.length/1024).toFixed(0)+'KB');
NODEEOF
