FROM node:20-alpine

# 1. Instala o OpenSSL (necessário para o Prisma no Alpine)
RUN apk add --no-cache openssl

WORKDIR /app

# 4. Instala as dependências
COPY package*.json ./
RUN npm ci

# 4.1 Gera o Prisma Client (necessita da pasta prisma)
COPY prisma ./prisma/
RUN npx prisma generate

# 5. COPIA TODO O CÓDIGO FONTE (Incluindo a pasta src)
# Isso deve vir ANTES do build do CSS
COPY . .

# 6. GERA O CSS FINAL
# Agora o Docker encontrará o caminho ./src/public/css/input.css
RUN npm run build:css

# 6. Limpa as dependências de dev (deixa a imagem mais leve)
RUN npm prune --omit=dev

# 7. O Pulo do Gato: Roda as migrations pendentes e DEPOIS inicia o app
# Tudo na mesma linha, sem precisar de entrypoint.sh!
CMD ["sh","-c","npx prisma db push || echo \"db push failed\"; npx prisma generate || echo \"prisma generate failed\"; node prisma/seed.js || echo \"seed failed\"; node src/server.js"]