const url = "https://sanskritacademy.delhi.gov.in/sites/default/files/2022-09/final_geeta.pdf";
fetch("https://api.urlmediainspector.dev/api/v1/inspect?profile=embed&expand=html", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
