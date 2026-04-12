const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: 'SHOPEE_SPC_ST' }});
  const cookie = cfg ? cfg.value : '';
  console.log('Cookie starts with:', cookie.substring(0, 15));
  
  const headers = {
    Host: 'shopee.vn',
    Cookie: cookie.includes('SPC_ST=') ? cookie : 'SPC_ST=' + cookie,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Android app Shopee appver=28320 app_type=1'
  };
  
  const res = await fetch('https://shopee.vn/api/v4/item/get?itemid=22857265957&shopid=11279821', { headers });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body length:', text.length);
  if (text.length > 500) {
      const data = JSON.parse(text);
      console.log('Models count:', data.data?.models?.length);
      if (data.data?.models?.length > 0) {
         console.log('First model:', JSON.stringify(data.data.models[0]));
      }
  } else {
      console.log('Body:', text);
  }
}
run().finally(() => prisma.$disconnect());
