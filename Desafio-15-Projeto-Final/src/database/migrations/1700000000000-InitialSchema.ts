import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE \`users\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`name\` varchar(80) NOT NULL,
      \`email\` varchar(160) NOT NULL,
      \`passwordHash\` varchar(100) NOT NULL,
      \`role\` varchar(20) NOT NULL DEFAULT 'customer',
      \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      UNIQUE INDEX \`IDX_users_email\` (\`email\`),
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB`);
    await q.query(`CREATE TABLE \`categories\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`name\` varchar(80) NOT NULL,
      \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      UNIQUE INDEX \`IDX_categories_name\` (\`name\`),
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB`);
    await q.query(`CREATE TABLE \`products\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`name\` varchar(120) NOT NULL,
      \`description\` text NULL,
      \`priceCents\` int NOT NULL,
      \`stock\` int NOT NULL,
      \`active\` tinyint NOT NULL DEFAULT 1,
      \`categoryId\` int NOT NULL,
      \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      INDEX \`IDX_products_category\` (\`categoryId\`),
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`FK_products_category\` FOREIGN KEY (\`categoryId\`) REFERENCES \`categories\`(\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB`);
    await q.query(`CREATE TABLE \`orders\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`userId\` int NOT NULL,
      \`status\` varchar(20) NOT NULL DEFAULT 'pending',
      \`totalCents\` int NOT NULL,
      \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX \`IDX_orders_user\` (\`userId\`),
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`FK_orders_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB`);
    await q.query(`CREATE TABLE \`order_items\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`orderId\` int NOT NULL,
      \`productId\` int NOT NULL,
      \`productName\` varchar(120) NOT NULL,
      \`unitPriceCents\` int NOT NULL,
      \`quantity\` int NOT NULL,
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`FK_items_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`FK_items_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `order_items`');
    await q.query('DROP TABLE `orders`');
    await q.query('DROP TABLE `products`');
    await q.query('DROP TABLE `categories`');
    await q.query('DROP TABLE `users`');
  }
}
