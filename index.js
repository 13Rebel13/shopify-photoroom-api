// index.js
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const axios = require('axios');
dotenv.config();

const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('API Shopify + Photoroom OK 🚀');
});

// 📦 Récupérer les crédits d’un client à partir de son email
async function getCustomerCredits(email) {
  const shopifyToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const shop = process.env.SHOPIFY_STORE;

  // 1. Récupérer l’ID du client par son email
  const search = await axios.get(`https://${shop}/admin/api/2023-10/customers/search.json?query=email:${email}`, {
    headers: {
      'X-Shopify-Access-Token': shopifyToken,
      'Content-Type': 'application/json',
    },
  });

  if (search.data.customers.length === 0) throw new Error("Client non trouvé");

  const customerId = search.data.customers[0].id;

  // 2. Lire les Metafields
  const meta = await axios.get(`https://${shop}/admin/api/2023-10/customers/${customerId}/metafields.json`, {
    headers: {
      'X-Shopify-Access-Token': shopifyToken,
    },
  });

  const creditField = meta.data.metafields.find(m => m.namespace === 'credits' && m.key === 'photoroom');

  const credits = creditField ? parseInt(creditField.value) : 0;

  return { customerId, credits, metafieldId: creditField?.id || null };
}

// 🔁 Mettre à jour ou créer les crédits du client
async function updateCredits(customerId, credits, metafieldId = null) {
  const shopifyToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const shop = process.env.SHOPIFY_STORE;

  if (metafieldId) {
    // Modifier l’existant
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
    // Créer un nouveau
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

// 📸 Endpoint principal : traitement Photoroom avec gestion de crédit
app.post('/photoroom/process', async (req, res) => {
  const { email, imageUrl } = req.body;

  if (!email || !imageUrl) {
    return res.status(400).json({ error: "Champs requis : email et imageUrl" });
  }

  try {
    const { customerId, credits, metafieldId } = await getCustomerCredits(email);

    if (credits <= 0) {
      return res.status(402).json({ error: "Pas assez de crédits" });
    }

    // Appel à l’API Photoroom
    const photoroomApiKey = process.env.PHOTOROOM_API_KEY;

    const response = await axios.post('https://sdk.photoroom.com/v1/segment', {
      image_url: imageUrl
    }, {
      headers: {
        'x-api-key': photoroomApiKey,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer'
    });

    // Mise à jour des crédits
    await updateCredits(customerId, credits - 1, metafieldId);

    // Réponse : image traitée
    res.set('Content-Type', 'image/png');
    res.send(response.data);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Erreur serveur", detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
