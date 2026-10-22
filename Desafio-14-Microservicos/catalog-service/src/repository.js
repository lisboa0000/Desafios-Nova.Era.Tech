const products = [
  { id: 1, name: 'Teclado mecanico', price: 349.9, category: 'perifericos' },
  { id: 2, name: 'Monitor 27 polegadas', price: 1599.0, category: 'monitores' },
  { id: 3, name: 'Mouse sem fio', price: 129.9, category: 'perifericos' },
  { id: 4, name: 'Headset USB', price: 259.0, category: 'audio' },
];

module.exports = {
  findAll: () => products,
  findById: (id) => products.find((p) => p.id === id) || null,
  findByIds: (ids) => products.filter((p) => ids.includes(p.id)),
};
