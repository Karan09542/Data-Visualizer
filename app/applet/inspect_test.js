import https from 'https';

const url = "https://api.urlmediainspector.dev/api/v1/inspect?profile=embed&expand=html";
const payload = JSON.stringify({ url: "https://api.github.com/users/octocat/events{/privacy}" });

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(payload);
req.end();
