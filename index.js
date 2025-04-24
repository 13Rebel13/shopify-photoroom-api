const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const FormData = require('form-data');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;

app.post('/remove-background', async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl manquant' });
  }

  try {
    let imageBuffer;
    let filename = 'image.png';

    // Cas 1 : image en base64 (depuis Shopify interface)
    if (imageUrl.startsWith('data:image/')) {
      const base64Data = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    }
    // Cas 2 : image distante (URL Shopify)
    else if (imageUrl.startsWith('http')) {
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(imageResponse.data);
    } else {
      return res.status(400).json({ error: 'Format imageUrl non reconnu' });
    }

    // Préparer form-data
    const form = new FormData();
    form.append('image_file', imageBuffer, { filename });

    // Appel API PhotoRoom
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
      console.error('Erreur PhotoRoom :', errorText);
      return res.status(500).json({
        error: 'Erreur PhotoRoom',
        detail: errorText
      });
    }

    const base64Image = Buffer.from(response.data).toString('base64');
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
