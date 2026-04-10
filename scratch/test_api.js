const http = require('http');

http.get('http://localhost:3000/api/user/notifications', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    console.log(`BODY: ${rawData.substring(0, 200)}...`);
  });
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
