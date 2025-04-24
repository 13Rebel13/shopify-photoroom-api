const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const FormData = require('form-data');

const app = express();
app.use(bodyParser.json());

const PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;

app.post('/remove-background', async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl manquant' });
  }

  try {
    // 1. Télécharger l’image Shopify
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });

    // 2. Préparer la requête multipart pour PhotoRoom
    const form = new FormData();
    form.append('image_file', Buffer.from(imageResponse.data), {
      filename: 'image.png'
    });

    // 3. Envoyer à PhotoRoom
    const response = await axios.post('https://sdk.photoroom.com/v1/segment', form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': PHOTOROOM_API_KEY
      },
      responseType: 'arraybuffer',
      validateStatus: () => true
    });

    if (response.status !== 200) {
      const errorText = Buffer.from(response.data).toString();
      console.error('Erreur PhotoRoom (upload) :', errorText);
      return res.status(500).json({
        error: 'Erreur PhotoRoom',
        detail: errorText
      });
    }

    const base64Image = Buffer.from(response.data, 'binary').toString('base64');
    res.json({ image: `data:image/png;base64,${base64Image}` });
  } catch (error) {
    console.error('Erreur serveur :', error.message);
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
