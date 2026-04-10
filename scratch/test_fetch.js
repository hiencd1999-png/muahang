const http = require('http');

async function test() {
  // Can't easily login without credentials, but we can verify if the route exists unconditionally!
  const res = await fetch("http://localhost:3000/api/user/notifications");
  const text = await res.text();
  console.log(res.status, text.substring(0, 100));
}

test();
