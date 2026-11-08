export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const { service, link, quantity } = req.body;

  try {
    const response = await fetch('https://notpanel.com/api/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: process.env.NOTPANEL_API_KEY,
        action: 'add',
        service: service,
        link: link,
        quantity: quantity
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Order failed' });
  }
}
