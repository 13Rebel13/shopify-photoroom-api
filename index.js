const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const axios = require('axios');
const multer = require('multer');

dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: '30mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '30mb' }));

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // max 10MB

app.get('/', (req, res) => {
  res.send('API Shopify + Photoroom OK 🚀');
});

// 🔍 Récupère les crédits d'un client à partir de son email
async function getCustomerCredits(email) {
  const shopifyToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const shop = process.env.SHOPIFY_STORE;

  const search = await axios.get(`https://${shop}/admin/api/2023-10/customers/search.json?query=email:${email}`, {
    headers: {
      'X-Shopify-Access-Token': shopifyToken,
      'Content-Type': 'application/json',
    },
  });

  if (search.data.customers.length === 0) throw new Error("Client non trouvé");

  const customerId = search.data.customers[0].id;

  const meta = await axios.get(`https://${shop}/admin/api/2023-10/customers/${customerId}/metafields.json`, {
    headers: {
      'X-Shopify-Access-Token': shopifyToken,
    },
  });

  const creditField = meta.data.metafields.find(m => m.namespace === 'credits' && m.key === 'photoroom');
  const credits = creditField ? parseInt(creditField.value) : 0;

  return { customerId, credits, metafieldId: creditField?.id || null };
}

// 🔁 Met à jour les crédits du client (crée ou modifie le Metafield)
async function updateCredits(customerId, credits, metafieldId = null) {
  const shopifyToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const shop = process.env.SHOPIFY_STORE;

  if (metafieldId) {
    await axios.put(`https://${shop}/admin/api/2023-10/metafields/${metafieldId}.json`, {
      metafield: {
        id: metafieldId,
        value: credits.toString(),
      }
    }, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      }
    });
  } else {
    await axios.post(`https://${shop}/admin/api/2023-10/customers/${customerId}/metafields.json`, {
      metafield: {
        namespace: "credits",
        key: "photoroom",
        type: "number_integer",
        value: credits.toString()
      }
    }, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      }
    });
  }
}

// 📤 Endpoint pour recevoir un fichier image via form-data
app.post('/photoroom/upload', upload.single('image'), async (req, res) => {
  const email = req.body.email;
  const imageFile = req.file;

  if (!email || !imageFile) {
    return res.status(400).json({ error: 'Champs requis : email et image (fichier)' });
  }

  try {
    const { customerId, credits, metafieldId } = await getCustomerCredits(email);

    if (credits <= 0) {
      return res.status(402).json({ error: "Pas assez de crédits" });
    }

    const photoroomApiKey = process.env.PHOTOROOM_API_KEY;

    const response = await axios.post('https://sdk.photoroom.com/v1/segment', imageFile.buffer, {
      headers: {
        'x-api-key': photoroomApiKey,
        'Content-Type': 'application/octet-stream',
      },
      responseType: 'arraybuffer'
    });

    await updateCredits(customerId, credits - 1, metafieldId);

    res.set('Content-Type', 'image/png');
    res.send(response.data);

  } catch (err) {
    console.error('Erreur dans /photoroom/upload:', err.message);
    res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
