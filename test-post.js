fetch('http://localhost:3000/config/sys_currency', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ currency_code: 'EUR', currency_name: 'Euro' })
}).then(r => r.json().then(data => console.log(r.status, data)))
