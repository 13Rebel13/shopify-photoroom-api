const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;

app.post('/remove-background', async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl manquant' });
  }

  console.log('Image reçue pour traitement :', imageUrl); // log debug

  try {
    const photoroomResponse = await axios({
      method: 'post',
      url: 'https://sdk.photoroom.com/v1/segment',
      headers: {
        'x-api-key': PHOTOROOM_API_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        image_url: imageUrl
      },
      responseType: 'arraybuffer',
      validateStatus: () => true
    });

    console.log('PhotoRoom status:', photoroomResponse.status); // debug

    if (photoroomResponse.status !== 200) {
      const errorText = Buffer.from(photoroomResponse.data).toString();
      console.error('Erreur PhotoRoom (détail) :', errorText);
      return res.status(500).json({
        error: 'Erreur PhotoRoom',
        detail: errorText
      });
    }

    const base64Image = Buffer.from(photoroomResponse.data, 'binary').toString('base64');
    res.json({ image: `data:image/png;base64,${base64Image}` });
  } catch (error) {
    console.error('Erreur interne :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/', (req, res) => {
  res.send('Shopify - PhotoRoom API OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API active sur le port ${PORT}`);
});
