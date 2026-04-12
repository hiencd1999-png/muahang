const fetch = require('node-fetch');
async function run() {
  const headers = {
    Host: 'shopee.vn',
    Cookie: 'SPC_ST=cUhaRXkzUlNETXpTSGhpbEfvdCbGuGGVMIlevIW1yojryPTSo5HXU1h/Spjo0wTiSaeqAn2FC+gZPEllKakVWb1FJ9H8ETrlV8jaU86Ydi3I5Zi4I44UcJG4q+BY+5yGPAyE2+u5xiKMWi4Hj2FDEuuoWrFPQDMI8ClMJo68BHDa23ONqfZdD0mTY7LfvfexpqZrLtXpdg93Nnqf9jm7XUJWkuMZCjqjtQpao2I/fDM=.ACS7m0s3hxgWKXhQx3p/jgau7A3cbtgPUAeQ+O8hFG1T',
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Android app Shopee appver=28320 app_type=1'
  };
  const res = await fetch('https://shopee.vn/api/v4/item/get?itemid=44479208511&shopid=1274547388', { headers });
  console.log('Status:', res.status);
  const text = await res.text();
  if (text.length > 500) {
    const data = JSON.parse(text);
    console.log('NodeJS Models count:', data.data?.models?.length);
  } else {
    console.log('NodeJS body:', text);
  }
}
run();
