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
  // --- Groups and sample apps for RBAC ---
  const groupNames = ['TI', 'INTELIGÊNCIA DE MERCADO', 'COMERCIAL', 'FINANCEIRO', 'MARKETING'];
  await prisma.group.createMany({ data: groupNames.map(n => ({ nome: n })), skipDuplicates: true });
  const createdGroups = await prisma.group.findMany({ where: { nome: { in: groupNames } } });

  // Ensure some sample apps exist
  const sampleApps = [
    { nome: 'SID', url: 'https://sid.local', descricao: 'Sid Application' },
    { nome: 'Campanhas', url: 'https://campanhas.local', descricao: 'Campanhas App' }
  ];
  await prisma.app.createMany({ data: sampleApps, skipDuplicates: true });
  const createdApps = await prisma.app.findMany({ where: { nome: { in: sampleApps.map(a => a.nome) } } });

  // Create some default group->app mappings
  const grupoMap = {};
  createdGroups.forEach(g => { grupoMap[g.nome] = g.id; });
  const appMap = {};
  createdApps.forEach(a => { appMap[a.nome] = a.id; });

  const groupAppData = [];
  if (grupoMap['TI']) {
    // TI has admin on everything we seeded
    if (appMap['SID']) groupAppData.push({ id_grupo: grupoMap['TI'], id_aplicacao: appMap['SID'], permissao: 'admin' });
    if (appMap['Campanhas']) groupAppData.push({ id_grupo: grupoMap['TI'], id_aplicacao: appMap['Campanhas'], permissao: 'admin' });
  }
  if (grupoMap['COMERCIAL'] && appMap['Campanhas']) {
    groupAppData.push({ id_grupo: grupoMap['COMERCIAL'], id_aplicacao: appMap['Campanhas'], permissao: 'normal' });
  }

  if (groupAppData.length > 0) {
    await prisma.groupApp.createMany({ data: groupAppData, skipDuplicates: true });
  }

  // Assign super admins to TI group if present
  if (grupoMap['TI']) {
    await prisma.user.updateMany({ where: { email: 'ti@drogamais.com.br' }, data: { groupId: grupoMap['TI'] } });
    await prisma.user.updateMany({ where: { email: 'inteligencia@drogamais.com.br' }, data: { groupId: grupoMap['TI'] } });
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