# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier tout le code frontend
COPY . .

# Exposer le port Next.js
EXPOSE 3000

# Lancer le serveur Next.js
CMD ["npm", "run", "dev"]
