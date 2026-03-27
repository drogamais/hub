// prisma/seed.js
require('dotenv').config(); // Carrega as variáveis do .env
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando o seed do banco de dados...');

  // Busca a senha segura do .env (se não existir, usa 'admin' como fallback para testes locais)
  const plainPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin';
  const defaultPassword = await bcrypt.hash(plainPassword, 10); 

  // Lista dos super admins baseada nas regras do seu front-end
  const superAdmins = [
    {
      username: 'inteligencia@drogamais.com.br',
      email: 'inteligencia@drogamais.com.br',
      first_name: 'Admin',
      last_name: 'Inteligência',
      setor: 'INTELIGÊNCIA DE MERCADO',
      is_active: true,
    }
  ];

  for (const adminData of superAdmins) {
    // O upsert garante que o usuário seja criado ou atualizado
    const user = await prisma.user.upsert({
      where: { email: adminData.email },
      update: {
        setor: adminData.setor,
        is_active: adminData.is_active,
        password: defaultPassword, // Atualiza a senha para o valor do .env (criptografada)
      },
      create: {
        username: adminData.username,
        email: adminData.email,
        first_name: adminData.first_name,
        last_name: adminData.last_name,
        setor: adminData.setor,
        is_active: adminData.is_active,
        password: defaultPassword, // Salva a senha criptografada no banco
      },
    });
    
    console.log(`✅ Super Admin garantido: ${user.email} (Setor: ${user.setor})`);
  }

  console.log('🎉 Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });