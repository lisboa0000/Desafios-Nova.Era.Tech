CREATE DATABASE IF NOT EXISTS orders_api CHARACTER SET utf8mb4;
USE orders_api;

CREATE TABLE customers (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(160) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE products (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  price      DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock      INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 1:N  customers -> orders
CREATE TABLE orders (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  status      ENUM('PENDING','PAID','SHIPPED','DELIVERED','CANCELED')
              NOT NULL DEFAULT 'PENDING',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  canceled_at TIMESTAMP NULL,
  INDEX idx_orders_customer (customer_id),
  INDEX idx_orders_created (created_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id)
    ON DELETE RESTRICT   -- não apaga cliente que tem pedidos
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- N:N  orders <-> products (tabela associativa com atributos próprios)
CREATE TABLE order_items (
  order_id   INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity   INT UNSIGNED NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,  -- preço congelado no momento da compra
  PRIMARY KEY (order_id, product_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE    -- apagar pedido apaga seus itens
    ON UPDATE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE RESTRICT   -- não apaga produto já vendido
    ON UPDATE CASCADE
) ENGINE=InnoDB;
