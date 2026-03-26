// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando o seed do banco de dados...');

  // Senha padrão para os super usuários (troque em produção)
  const defaultPassword = await bcrypt.hash('admin', 10); 

  // Lista dos super admins baseada nas regras do seu front-end
  const superAdmins = [
    {
      username: 'ti@drogamais.com.br',
      email: 'ti@drogamais.com.br',
      first_name: 'Admin',
      last_name: 'TI',
      role: 'admin',
      setor: 'TI',
      is_active: true,
    },
    {
      username: 'inteligencia@drogamais.com.br',
      email: 'inteligencia@drogamais.com.br',
      first_name: 'Admin',
      last_name: 'Inteligência',
      role: 'admin',
      setor: 'INTELIGÊNCIA DE MERCADO',
      is_active: true,
    }
  ];

  for (const adminData of superAdmins) {
    // O upsert garante que o usuário seja criado ou atualizado (caso já exista sem o setor)
    const user = await prisma.user.upsert({
      where: { email: adminData.email },
      update: {
        role: adminData.role,
        setor: adminData.setor, // Força a atualização do setor se o usuário já existir
        is_active: adminData.is_active,
      },
      create: {
        ...adminData,
        password: defaultPassword,
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