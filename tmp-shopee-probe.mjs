import dotenv from "dotenv";
dotenv.config({path: './.env'});
const cookie = process.env.COOKIE || '';
const url = 'https://shopee.vn/product/213079533/21932915134';
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Referer': 'https://shopee.vn/',
  'Cookie': cookie,
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
};
const res = await fetch(url, { method: 'GET', headers });
const text = await res.text();
const regex = /<script[^>]+src=["']([^"']+)["']/gi;
let m;
const urls = [];
while ((m = regex.exec(text))) {
  urls.push(m[1]);
}
console.log(urls.length);
console.log(urls.join('\n'));
