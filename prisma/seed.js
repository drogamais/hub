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
      setor: 'TI',
      is_active: true,
    },
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
    // O upsert garante que o usuário seja criado ou atualizado (caso já exista sem o setor)
    const user = await prisma.user.upsert({
      where: { email: adminData.email },
      update: {
        setor: adminData.setor, // Força a atualização do setor se o usuário já existir
        is_active: adminData.is_active,
      },
      create: {
        username: adminData.username,
        email: adminData.email,
        first_name: adminData.first_name,
        last_name: adminData.last_name,
        setor: adminData.setor,
        is_active: adminData.is_active,
        password: defaultPassword,
      },
    });
    
    console.log(`✅ Super Admin garantido: ${user.email} (Setor: ${user.setor})`);
  }

  // Ensure some sample apps exist
  const sampleApps = [
    { nome: 'SID', url: 'https://sid.local', descricao: 'Sid Application' },
    { nome: 'Campanhas', url: 'https://campanhas.local', descricao: 'Campanhas App' }
  ];
  await prisma.app.createMany({ data: sampleApps, skipDuplicates: true });
  const createdApps = await prisma.app.findMany({ where: { nome: { in: sampleApps.map(a => a.nome) } } });

  // Assign admin permissions for super admins directly to rel_usuario_aplicacao (UserApp)
  const appMap = {};
  createdApps.forEach(a => { appMap[a.nome] = a.id; });

  const userAppData = [];
  for (const adminData of superAdmins) {
    const user = await prisma.user.findUnique({ where: { email: adminData.email } });
    if (!user) continue;
    // Grant admin on all seeded apps to super admins
    Object.values(appMap).forEach(appId => {
      userAppData.push({ id_usuario: user.id, id_aplicacao: appId, permissao: 'admin' });
    });
  }

  if (userAppData.length > 0) {
    await prisma.userApp.createMany({ data: userAppData, skipDuplicates: true });
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