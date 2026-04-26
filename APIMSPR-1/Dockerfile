FROM node:20-alpine

WORKDIR /app

# Installer les dépendances de production uniquement
COPY package*.json ./
RUN npm ci --omit=dev

# Copier les sources (pas le client React — le build est dans public/dist)
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "src/index.js"]
