const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Mandray ny tahiry amin'ny endrika JSON
app.use(express.json());

// Mamoaka ireo rakitra ao amin'ny folder public ho an'ny mpitsidika
app.use(express.static(path.join(__dirname, 'public')));

// Mampandeha ny server eo amin'ny seranan-tsambo voatendry
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
