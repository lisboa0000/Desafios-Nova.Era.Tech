import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { mysqlOptions } from './database.config';
import { Category, Product, User } from './entities';

const env = process.env;

async function seed() {
  const ds = new DataSource(mysqlOptions(env));
  await ds.initialize();
  const rounds = Number(env.BCRYPT_ROUNDS ?? 12);

  const users = ds.getRepository(User);
  const accounts = [
    { name: 'Administrador', email: env.ADMIN_EMAIL ?? 'admin@marketplace.dev', password: env.ADMIN_PASSWORD ?? 'admin12345', role: 'admin' as const },
    { name: 'Cliente Demo', email: 'cliente@marketplace.dev', password: 'cliente12345', role: 'customer' as const },
  ];
  for (const a of accounts) {
    if (await users.findOne({ where: { email: a.email } })) continue;
    await users.save(users.create({ name: a.name, email: a.email, passwordHash: await bcrypt.hash(a.password, rounds), role: a.role }));
  }

  const categories = ds.getRepository(Category);
  const products = ds.getRepository(Product);
  const catalog: Record<string, { name: string; priceCents: number; stock: number }[]> = {
    Eletronicos: [
      { name: 'Fone Bluetooth', priceCents: 15990, stock: 50 },
      { name: 'Teclado Mecanico', priceCents: 29990, stock: 20 },
    ],
    Livros: [
      { name: 'Clean Code', priceCents: 8990, stock: 30 },
      { name: 'Domain-Driven Design', priceCents: 12990, stock: 10 },
    ],
  };
  for (const [name, items] of Object.entries(catalog)) {
    let category = await categories.findOne({ where: { name } });
    if (!category) category = await categories.save(categories.create({ name }));
    for (const p of items) {
      if (await products.findOne({ where: { name: p.name } })) continue;
      await products.save(products.create({ ...p, description: null, categoryId: category.id }));
    }
  }

  await ds.destroy();
  console.log('seed concluido');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
