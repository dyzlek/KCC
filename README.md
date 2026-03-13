# 🎮 KC Catalogue

**KC Catalogue** est une plateforme moderne permettant de gérer sa collection de jeux vidéo, de suivre ses amis et de découvrir de nouveaux titres via l'API IGDB. Le projet est conçu avec une architecture robuste, une interface dynamique et des fonctionnalités sociales.

---

## 🚀 Technologies Utilisées

- **Backend** : Node.js avec le framework [Express](https://expressjs.com/)
- **Base de données** : [MySQL](https://www.mysql.com/) avec `mysql2/promise`
- **Templates** : [Nunjucks](https://mozilla.github.io/nunjucks/) pour un rendu serveur performant
- **Authentification** : [Passport.js](https://www.passportjs.org/) (support de Steam)
- **API** : Intégration complète avec [IGDB API](https://api-docs.igdb.com/)
- **Style** : Vanilla CSS avec un focus sur une esthétique premium et responsive

---

## 📦 Installation & Configuration

### 1. Prérequis
- [Node.js](https://nodejs.org/) (version 18+ recommandée)
- [MySQL](https://www.mysql.com/)

### 2. Clonage et Dépendances
```bash
git clone https://github.com/dyzlek/kccatalogue.git
cd kccatalogue
npm install
```

### 3. Configuration de l'environnement
Copiez le fichier `.env.template` vers un nouveau fichier `.env` et remplissez les variables nécessaires :
```bash
cp .env.template .env
```
Assurez-vous de configurer les clés API IGDB (`CLIENT_ID` et `ACCESS_TOKEN`) ainsi que les identifiants de votre base de données locale.

### 4. Initialisation de la Base de Données
Exécutez le script SQL fourni pour créer la structure de la base :
- Utilisez un client comme MySQL Workbench ou la ligne de commande pour lancer `database.sql`.

---

## 🏃 Comment Lancer le Projet

### Mode Développement
Le projet utilise `--watch` pour redémarrer automatiquement lors de modifications :
```bash
npm run dev
```
L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

---

## 📂 Structure du Projet

```text
kccatalogue/
├── public/             # Fichiers statiques (images, CSS, JS frontend)
├── scripts/            # Scripts utilitaires de migration et de test
├── src/                # Code source de l'application
│   ├── config/         # Configuration (DB, Passport, etc.)
│   ├── controllers/    # Logique métier des routes
│   ├── models/         # (Optionnel) Modèles de données
│   ├── routes/         # Définition des points d'accès (endpoints)
│   ├── services/       # Services tiers (ex: IGDB API)
│   └── app.js          # Point d'entrée de l'application
├── views/              # Templates Nunjucks (.njk)
├── database.sql        # Schéma complet de la base de données
└── package.json        # Dépendances et scripts
```

---

## ✨ Fonctionnalités Clés

- **Gestion de Profil** : Personnalisation avec avatar, bannière et bio.
- **Collection & Wishlist** : Ajoutez des jeux à votre bibliothèque avec des statuts (Terminé, En cours, etc.).
- **Système de Reviews** : Notez (sur 10) et critiquez vos jeux favoris.
- **Social** : Suivez d'autres utilisateurs et consultez leur activité.
- **Mini-jeux** : Section interactive comme le "Higher Lower" basé sur les notes des jeux.
- **Intégration IGDB** : Données de jeux toujours à jour (screenshots, notes, dates de sortie).

---

## 🛠️ Maintenance & Tests

Des scripts utilitaires sont disponibles dans le dossier `scripts/` pour :
- Vérifier la connexion à la base de données.
- Tester les redirections de profil.
- Réconcilier le schéma en cas de mise à jour.

```bash
node scripts/test_db_connection.js
```

---

## 📄 Licence

Ce projet est sous licence ISC.
