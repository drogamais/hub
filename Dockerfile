FROM node:20-alpine

# 1. Instala o OpenSSL (necessário para o Prisma no Alpine)
RUN apk add --no-cache openssl

WORKDIR /app

# 2. Copia os arquivos de dependência e a pasta prisma (que tem o schema)
COPY package*.json ./
COPY prisma ./prisma/

# 3. Instala TODAS as dependências primeiro. 
# Precisamos do 'prisma' que está nas devDependencies para gerar o client
RUN npm ci

# 4. Gera o Prisma Client
RUN npx prisma generate

# 5. Copia o resto do código da aplicação
COPY . .

# 6. Limpa as dependências de dev (deixa a imagem mais leve)
RUN npm prune --omit=dev

# 7. O Pulo do Gato: Roda as migrations pendentes e DEPOIS inicia o app
# Tudo na mesma linha, sem precisar de entrypoint.sh!
CMD ["sh","-c","npx prisma migrate deploy || echo \"migrate failed\" && node src/server.js"]